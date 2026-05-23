<?php
/**
 * Conversion fichiers RAW → PNG (8 bits) pour développement dans le navigateur.
 * Requiert l’extension PHP Imagick (ImageMagick) et les délégués RAW (libraw),
 * ou la commande « magick » / « convert » en ligne de commande.
 *
 * Formats courants pris en charge (selon la build ImageMagick) :
 * Canon CR2/CR3, Nikon NEF/NRW, Sony ARW, Adobe DNG, Fujifilm RAF, Olympus ORF,
 * Panasonic RW2, Pentax PEF, Samsung SRW, Hasselblad 3FR, Phase One IIQ, Leica RWL,
 * Sigma X3F, Kodak DCR/KDC, etc.
 */
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Méthode non autorisée.';
    exit;
}

$maxBytes = 120 * 1024 * 1024;
$allowedExt = [
    '3fr', 'arw', 'bay', 'cap', 'cr2', 'cr3', 'dcr', 'dcs', 'dng', 'drf', 'eip',
    'erf', 'fff', 'iiq', 'j6i', 'k25', 'kdc', 'mdc', 'mef', 'mos', 'mrw', 'nef',
    'nrw', 'obm', 'orf', 'pef', 'pxn', 'r3d', 'raf', 'raw', 'rw2', 'rwz', 'rwl',
    'sr2', 'srf', 'srw', 'x3f',
];

if (!isset($_FILES['raw']) || !is_uploaded_file($_FILES['raw']['tmp_name'])) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Aucun fichier RAW reçu.';
    exit;
}

$f = $_FILES['raw'];
if (($f['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Échec du téléversement.';
    exit;
}

if (($f['size'] ?? 0) > $maxBytes) {
    http_response_code(413);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Fichier trop volumineux.';
    exit;
}

$name = isset($f['name']) ? strtolower($f['name']) : '';
$ext = pathinfo($name, PATHINFO_EXTENSION);
if ($ext === '' || !in_array($ext, $allowedExt, true)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Extension RAW non reconnue.';
    exit;
}

$tmp = $f['tmp_name'];
$outPng = null;

function illu_try_imagick(string $path): ?string {
    if (!class_exists('Imagick')) {
        return null;
    }
    try {
        $im = new Imagick();
        $im->readImage($path . '[0]');
        @$im->setImageAlphaChannel(11);
        $im->setImageBackgroundColor(new ImagickPixel('white'));
        $im->setImageColorspace(Imagick::COLORSPACE_SRGB);
        $im->setImageFormat('png');
        $im->setImageDepth(8);
        $blob = $im->getImageBlob();
        $im->clear();
        $im->destroy();
        return $blob !== false && strlen($blob) > 0 ? $blob : null;
    } catch (Throwable $e) {
        return null;
    }
}

function illu_try_cli(string $path): ?string {
    $candidates = ['magick', 'convert'];
    foreach ($candidates as $bin) {
        $cmd = sprintf(
            '%s %s -colorspace sRGB -depth 8 png:- 2>/dev/null',
            escapeshellcmd($bin),
            escapeshellarg($path . '[0]')
        );
        $out = @shell_exec($cmd);
        if (is_string($out) && strlen($out) > 100) {
            return $out;
        }
    }
    return null;
}

$blob = illu_try_imagick($tmp);
if ($blob === null) {
    $blob = illu_try_cli($tmp);
}

if ($blob === null) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Conversion RAW indisponible : installez php-imagick (ImageMagick avec support RAW) ou l’outil « magick ».';
    exit;
}

header('Content-Type: image/png');
header('Cache-Control: no-store');
echo $blob;
