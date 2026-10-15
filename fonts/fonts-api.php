<?php
header('Content-Type: application/json');
$dir = __DIR__;
$fonts = [];

if (is_dir($dir)) {
    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (in_array($ext, ['ttf', 'otf', 'woff', 'woff2'])) {
            $name = pathinfo($file, PATHINFO_FILENAME);
            $fonts[] = [
                'name' => $name,
                'file' => $file,
                'url' => 'fonts/' . rawurlencode($file)
            ];
        }
    }
}
echo json_encode($fonts);
