<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Theme_Helpers {
	public static function post_count() {
		global $wp_query;
		if ( isset( $wp_query->posts ) ) {
			return count( $wp_query->posts );
		}

		return false;
	}

	/**
	 * Pick a class based on how many posts the query returned.
	 *
	 * The result is echoed into an attribute (post_class(), class="..."), so it
	 * is escaped on the way out even though the current call sites only pass
	 * static strings.
	 */
	public static function get_class( $many, $single, $echo = true ) {
		$class = ( 1 < self::post_count() ) ? $many : $single;

		if ( $echo ) {
			echo esc_attr( $class );
		} else {
			return $class;
		}
	}
}
