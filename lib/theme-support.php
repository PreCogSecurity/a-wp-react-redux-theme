<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists( 'Theme_Support' ) ) :

	class Theme_Support {
		function __construct() {
		}

		function init() {
			$this->hooks();
			$this->menus();
		}

		private function hooks() {
			$this->remove_junk();
			add_theme_support( 'post-thumbnails' );
			add_filter( 'rest_allow_anonymous_comments', [ $this, 'allow_anonymous_comments' ] );
			add_action( 'after_setup_theme', [ $this, 'title_tag' ] );
			add_filter( 'nav_menu_css_class', [ $this, 'bootstrap_menu_classes' ], 1, 3 );
			add_filter( 'nav_menu_link_attributes', [ $this, 'bootstrap_menu_link_classes' ], 10, 3 );
			add_action( 'get_search_form', [ $this, 'alt_search_form' ] );
		}

		/**
		 * Decide whether the REST API should accept comments from logged out
		 * visitors.
		 *
		 * The theme used to return `__return_true` here unconditionally, which
		 * ignored the site's own "users must be registered and logged in to
		 * comment" setting and left every installation as an open, unauthenticated
		 * comment endpoint. That is a spam magnet and a stored-content injection
		 * surface, so the default now mirrors the classic `wp-comments-post.php`
		 * gate: registration required means no anonymous comments.
		 *
		 * Sites that genuinely want open anonymous commenting can still opt back
		 * in, either by turning the registration option off or with the
		 * `react_theme_allow_anonymous_comments` filter.
		 */
		public function allow_anonymous_comments( $allow ) {
			if ( $allow ) {
				return true;
			}

			if ( get_option( 'comment_registration' ) ) {
				return false;
			}

			return (bool) apply_filters( 'react_theme_allow_anonymous_comments', true );
		}

		/**
		 * Whether logged out visitors may comment, mirrored into RT_API so the
		 * front end can hide the comment form instead of offering a form whose
		 * submission the API is going to reject.
		 */
		public static function allows_anonymous_comments() {
			return (bool) apply_filters(
				'rest_allow_anonymous_comments',
				! get_option( 'comment_registration' )
			);
		}

		function bootstrap_menu_classes( $classes, $item, $args ) {
			$classes[] = 'nav-item';

			return $classes;
		}

		function bootstrap_menu_link_classes( $atts, $item, $args ) {
			$atts['class'] = 'nav-link';

			return $atts;
		}

		/**
		 * Server-rendered fallback search form.
		 *
		 * The markup is assembled by hand, so every interpolated value is escaped
		 * explicitly and exactly once. We apply the `get_search_query` filter to
		 * the raw query var rather than calling get_search_query(), whose
		 * escaping varies by WordPress version - double escaping a value would
		 * show a visitor searching for "a & b" the literal text "a &amp; b".
		 */
		function alt_search_form() {
			$search_term = apply_filters( 'get_search_query', get_query_var( 's' ) );

			if ( ! is_string( $search_term ) ) {
				$search_term = '';
			}

			return sprintf(
				'<form role="search" method="get" id="searchform" class="form-inline my-2 my-lg-0" action="%1$s">
					<label class="sr-only" for="searchform-input">%2$s</label>
					<input type="search" id="searchform-input" value="%3$s" name="s" class="form-control mr-sm-2" placeholder="%4$s" />
				</form>',
				esc_url( home_url( '/' ) ),
				esc_html__( 'Search for:', 'react-theme' ),
				esc_attr( $search_term ),
				esc_attr__( 'Search for...', 'react-theme' )
			);
		}

		private function remove_junk() {
			remove_action( 'wp_head', 'rsd_link' ); // remove really simple discovery link
			remove_action( 'wp_head', 'wp_generator' ); // remove wordpress version

			remove_action( 'wp_head', 'feed_links', 2 ); // remove rss feed links (make sure you add them in yourself if youre using feedblitz or an rss service)
			remove_action( 'wp_head', 'feed_links_extra', 3 ); // removes all extra rss feed links

			remove_action( 'wp_head', 'index_rel_link' ); // remove link to index page
			remove_action( 'wp_head', 'wlwmanifest_link' ); // remove wlwmanifest.xml (needed to support windows live writer)

			remove_action( 'wp_head', 'start_post_rel_link', 10, 0 ); // remove random post link
			remove_action( 'wp_head', 'parent_post_rel_link', 10, 0 ); // remove parent post link
			remove_action( 'wp_head', 'adjacent_posts_rel_link', 10, 0 ); // remove the next and previous post links
			remove_action( 'wp_head', 'adjacent_posts_rel_link_wp_head', 10, 0 );

			remove_action( 'wp_head', 'wp_shortlink_wp_head', 10, 0 );
		}

		private function menus() {
			register_nav_menus( array(
				'main_menu'   => 'Main Menu',
				'footer_menu' => 'Footer Menu',
			) );
		}


		public function title_tag() {
			add_theme_support( 'title-tag' );
		}

	}

endif;
