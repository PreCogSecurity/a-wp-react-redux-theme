<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists( 'Theme_Enqueue' ) ) :

	class Theme_Enqueue {
		private $version = '20171210';

		function __construct() {
			// use this for developments
//			$this->version = date('U');
		}

		function init() {
			add_action( 'wp_enqueue_scripts', [ $this, 'theme' ], 20 );
		}

		function theme() {
			/*
			 * Subresource Integrity on the Bootstrap CDN asset.
			 *
			 * A third-party CDN is a single point of failure for every page of
			 * every site running this theme: if maxcdn is compromised or a
			 * network position is hostile, unverified CSS can be injected into
			 * trusted pages. The hash pins the exact bytes we reviewed.
			 *
			 * wp_style_add_data() is available on every supported WordPress
			 * version; core only *emits* the attribute on versions that support
			 * it, so this degrades to today's (unverified) behaviour rather
			 * than breaking the stylesheet.
			 */
			$bootstrap_css = 'https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0-beta/css/bootstrap.min.css';
			$bootstrap_sri = 'sha384-fd8ea90fa155fd5bf61c99c0eadfafb2553a7f06178c216d704a476cd274972005b174ec8c16df6838f300b790b0de8c';

			wp_enqueue_style( 'bootstrap4-css', $bootstrap_css, [], '4b' );
			wp_style_add_data( 'bootstrap4-css', 'integrity', $bootstrap_sri );
			wp_style_add_data( 'bootstrap4-css', 'crossorigin', 'anonymous' );

			wp_enqueue_script( 'ReactTheme-js', get_template_directory_uri() . '/bundle.js', [ 'jquery' ], $this->version, true );

			/*
			 * Runtime configuration handed to the browser as the `RT_API` global.
			 *
			 * SECURITY: this payload is deliberately limited to public site
			 * metadata plus the REST nonce. It must never include
			 * wp_get_current_user() (or any other object holding the user row):
			 * wp_localize_script() runs the value through wp_json_encode(), and
			 * WP_User::$data is a *public* property containing the full wp_users
			 * row - including the password hash and the password-reset
			 * activation key. Serialising it put live credential material into
			 * the HTML source of every page for every logged-in visitor. The
			 * front end never referenced it.
			 */
			wp_localize_script( 'ReactTheme-js', 'RT_API', array(
				'root'            => esc_url_raw( rest_url() ),
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'siteName'        => get_bloginfo( 'name' ),
				'baseUrl'         => get_bloginfo( 'url' ),
				'siteDescription' => get_bloginfo( 'description' ),
				'categories'      => $this->get_categories_with_links(),
				'allowAnonymousComments' => Theme_Support::allows_anonymous_comments()
			) );
			wp_enqueue_style( 'theme_stylesheet', get_template_directory_uri() . '/bundle.css', [ 'bootstrap4-css' ], $this->version );
		}

		/**
		 * Build the category payload consumed by src/components/main/article.js.
		 *
		 * Only the fields the front end actually reads are returned, so the
		 * payload stays small and does not leak category descriptions/counts that
		 * the React layer never uses.
		 */
		function get_categories_with_links() {
			$categories = get_categories( [ 'hide_empty' => 0 ] );
			$payload    = [];

			foreach ( $categories as $category ) {
				$payload[] = array(
					'term_id' => (int) $category->term_id,
					'name'    => $category->name,
					'slug'    => $category->slug,
					'link'    => get_category_link( $category->term_id ),
				);
			}

			return $payload;
		}
	}

endif;
