<?php
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$passRecu = $data['pass'] ?? '';

// Lecture du fichier de config
$configFile = '../G-MAPP/XbGv89Lm.json';

if (file_exists($configFile)) {
    $config = json_decode(file_get_contents($configFile), true);
    $passAttendu = $config['Gestion']['BASIC'] ?? null;

    if ($passRecu === $passAttendu) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "Invalid password"]);
    }
} else {
    echo json_encode(["success" => false, "message" => "Config file missing"]);
}