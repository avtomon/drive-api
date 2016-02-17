<?php
/**
 * Created by PhpStorm.
 * User: Александр
 * Date: 28.01.2016
 * Time: 19:18
 */

require_once AUTOLOAD_PATH;

$service_account_name = SERVICE_ACCOUNT_NAME;
$key_file_location = KEY_FILE_LOCATION;

$client = new Google_Client();

$key = file_get_contents($key_file_location);
$cred = new Google_Auth_AssertionCredentials(
    $service_account_name,
    array('https://www.googleapis.com/auth/drive'),
    $key
);
$client->setAssertionCredentials($cred);

if ($client->isAccessTokenExpired()) {
    $client->getAuth()->refreshTokenWithAssertion($cred);
}

echo json_decode($client->getAccessToken(), true)['access_token'];

//return json_decode($client->getAccessToken(), true)['access_token'];