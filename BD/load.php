<?php
header('Content-Type: application/json');

$user = isset($_GET['user']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['user']) : null;

if (!$user) {
    echo json_encode([]);
    exit;
}

$baseDir = "../G-MAPP/data/{$user}_";
$data = [];

if (file_exists($baseDir)) {
    $files = glob("{$baseDir}/BD_*");
    foreach ($files as $file) {
        $key = str_replace("BD_", "", basename($file));
        $content = file_get_contents($file);
        
        // On tente de décoder si c'est du JSON, sinon on laisse en string
        $jsonDecoded = json_decode($content, true);
        $data[$key] = (json_last_error() === JSON_ERROR_NONE) ? $jsonDecoded : $content;
    }
}

echo json_encode($data);