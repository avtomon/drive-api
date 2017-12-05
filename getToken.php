<?php

require_once 'config.php';

$client = new Google_Client();

$key = file_get_contents($_SERVER['DOCUMENT_ROOT'] . '/' . KEY_FILE_LOCATION);
$cred = new Google_Auth_AssertionCredentials(
    SERVICE_ACCOUNT_NAME,
    array('https://www.googleapis.com/auth/drive'),
    $key
);
$client->setAssertionCredentials($cred);

if ($client->isAccessTokenExpired()) {
    $client->getAuth()->refreshTokenWithAssertion($cred);
}

echo json_decode($client->getAccessToken(), true)['access_token'];

//return json_decode($client->getAccessToken(), true)['access_token'];