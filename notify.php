<?php
// API endpoint to handle email notifications
// Your secret webhook URL (keep this file private!)
define('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/1301189616241610814/R8hRiJIxmiRGX3P-QJ8vmGRQBYk9sOoHVIrMHZHQHDBUjCBRAQb4h1CiBZ8bui50fyH2');

// Set headers
header('Content-Type: application/json');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$email = isset($input['email']) ? trim($input['email']) : '';

// Validate email
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email address']);
    exit;
}

// Send to Discord webhook
$data = json_encode([
    'content' => "📧 New maintenance notification request: " . $email
]);

$options = [
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => $data
    ]
];

$context = stream_context_create($options);
$result = @file_get_contents(DISCORD_WEBHOOK_URL, false, $context);

if ($result !== false) {
    echo json_encode([
        'success' => true,
        'message' => 'Notification sent successfully'
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send notification']);
}
?>
