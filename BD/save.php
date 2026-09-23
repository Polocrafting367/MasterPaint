<?php
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$payload = json_decode($json, true);

if (!$payload || !isset($payload['user']) || !isset($payload['data'])) {
    echo json_encode(["status" => "error", "message" => "Données invalides"]);
    exit;
}

$user = preg_replace('/[^a-zA-Z0-9_\-]/', '', $payload['user']); // Sécurité nom dossier
$baseDir = "../G-MAPP/data/{$user}_";

if (!file_exists($baseDir)) {
    mkdir($baseDir, 0777, true);
}

foreach ($payload['data'] as $key => $value) {
    $filePath = "{$baseDir}/BD_{$key}";
    
    if ($value === null) {
        if (file_exists($filePath)) unlink($filePath);
    } else {
        // On stocke la valeur brute (comme localStorage)
        file_put_contents($filePath, $value);
    }
}

echo json_encode(["status" => "success"]);