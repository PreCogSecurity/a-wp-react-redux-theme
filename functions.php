<?php
/**
 * Theme bootstrap.
 *
 * The ABSPATH guard stops the file from being requested directly over HTTP, and
 * __DIR__ anchors the includes to the theme directory instead of whatever the
 * current working directory happens to be - a relative include breaks as soon
 * as WordPress (or a plugin) changes the CWD before the theme loads.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

include_once __DIR__ . '/lib/theme-helpers.php';
include_once __DIR__ . '/lib/theme-support.php';
include_once __DIR__ . '/lib/theme-enqueue.php';
include_once __DIR__ . '/lib/theme-endpoints.php';

$Theme_Support = new Theme_Support();
$Theme_Support->init();

$Theme_Enqueue = new Theme_Enqueue();
$Theme_Enqueue->init();

$Theme_Endpoints = new Theme_Endpoints();
$Theme_Endpoints->init();
