<?php

if(!function_exists("Path")) {
    return;
}

if(!isset($SteamAPI_KEY) || empty($SteamAPI_KEY)) {
    echo 'for website owner:<br>please enter a valid steam web api key.';
    exit;
}

if(isset($_SESSION['steamid'])) {
    header('Location: '.GetPrefix().'skins');
    exit;
}

if(!empty($_GET['openid_claimed_id'])) {
    $arr = explode('/', $_GET['openid_claimed_id']);
    $steamid = $arr[count($arr)-1];

    $_SESSION['steamid'] = $steamid;
    header('Location: '.GetPrefix().'skins');
    exit;
}

try {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    $url = $_SERVER['SERVER_NAME'];
    $protocol = $isHttps ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'].GetPrefix();

    $realm     = $protocol . '://' . $host;
    $return_to = $realm . 'authorize';

    $params = [
        'openid.ns'         => 'http://specs.openid.net/auth/2.0',
        'openid.mode'       => 'checkid_setup',
        'openid.return_to'  => $return_to,
        'openid.realm'      => $realm,
        'openid.identity'   => 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id' => 'http://specs.openid.net/auth/2.0/identifier_select'
    ];

    header('Location: https://steamcommunity.com/openid/login?' . http_build_query($params));
}catch(Exception $exception) {
    $documentError_Code = $exception->getCode();
    $documentError_Message = $exception->getMessage();

    $documentError_Message .= "<br>please contact website owner for help.";

    include_once './errorpage.php';
}