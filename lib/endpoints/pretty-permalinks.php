<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists( 'Pretty_Permalinks_Endpoint' ) ) :

	class Pretty_Permalinks_Endpoint {
		/** Longest permalink we are willing to resolve. */
		const MAX_URL_LENGTH = 512;

		function __construct() {
		}

		function init() {
			add_action( 'rest_api_init', function () {
				$namespace = 'react-theme/v1';
				register_rest_route( $namespace, '/prettyPermalink/(?P<url>.*?)', array(
					'methods'             => WP_REST_Server::READABLE,
					/*
					 * Public on purpose: this route only resolves a permalink to a
					 * post id, and the per-post access decision is made by
					 * WP_REST_Posts_Controller::get_item(), which refuses drafts,
					 * private and password protected posts. Declaring the callback
					 * explicitly also keeps the route valid on WordPress 5.5+,
					 * which rejects routes registered without one.
					 */
					'permission_callback' => '__return_true',
					'callback'            => [ $this, 'get_post_for_url' ],
					'args'                => array(
						'url' => array(
							'required'          => true,
							'type'              => 'string',
							'validate_callback' => [ $this, 'validate_url' ],
						),
					),
				) );
			} );
		}

		/**
		 * Reject anything that is not a site-relative path.
		 *
		 * `url` arrives straight off the URL, and url_to_postid() would happily
		 * run the rewrite rules against it. Restricting it to a relative path
		 * keeps the endpoint from being used to probe other hosts and blocks
		 * control characters, traversal and oversized input.
		 */
		public function validate_url( $value ) {
			if ( ! is_string( $value ) || '' === $value || strlen( $value ) > self::MAX_URL_LENGTH ) {
				return new WP_Error(
					'react_theme_invalid_url',
					__( 'The requested URL is not valid.', 'react-theme' ),
					[ 'status' => 400 ]
				);
			}

			// 1 === ... so a PCRE failure (which returns false) cannot read as "clean".
			$has_bad_characters = 1 === preg_match( '/[\x00-\x1f\x7f]/', $value );
			$has_host           = ! empty( parse_url( $value, PHP_URL_HOST ) );
			$has_traversal      = in_array( '..', explode( '/', $value ), true );

			if ( $has_bad_characters || $has_host || $has_traversal ) {
				return new WP_Error(
					'react_theme_invalid_url',
					__( 'The requested URL is not valid.', 'react-theme' ),
					[ 'status' => 400 ]
				);
			}

			return true;
		}

		/**
		 * Resolve a pretty permalink and return the post as the WP REST API would.
		 *
		 * @param WP_REST_Request $request
		 *
		 * @return WP_Error|WP_REST_Response
		 */
		public function get_post_for_url( $request ) {
			$post_id = url_to_postid( $request['url'] );

			if ( ! $post_id ) {
				return new WP_Error(
					'react_theme_post_not_found',
					__( 'No post was found for that URL.', 'react-theme' ),
					[ 'status' => 404 ]
				);
			}

			$post_type = get_post_type( $post_id );

			if ( ! $post_type || ! post_type_exists( $post_type ) ) {
				return new WP_Error(
					'react_theme_post_not_found',
					__( 'No post was found for that URL.', 'react-theme' ),
					[ 'status' => 404 ]
				);
			}

			$controller = new WP_REST_Posts_Controller( $post_type );

			/*
			 * Build the request against the post type's real REST route so
			 * irregular pluralisation ("person" -> "/wp/v2/people") does not
			 * produce a route that no filter or callback recognises.
			 */
			$route = function_exists( 'rest_get_route_for_post_type_items' )
				? rest_get_route_for_post_type_items( $post_type )
				: '';
			$route = $route ? $route : '/wp/v2/' . $post_type . 's';

			$post_request = new WP_REST_Request( 'GET', $route );
			$post_request->set_url_params( [ 'id' => $post_id ] );

			return $controller->get_item( $post_request );
		}

	}

endif;
