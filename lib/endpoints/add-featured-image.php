<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists( 'Add_Featured_Image_Endpoint' ) ) :
	class Add_Featured_Image_Endpoint {
		function init() {
			add_filter( 'rest_prepare_post', [ $this, 'add_featured_image' ], 10, 2 );

		}

		/**
		 * Expose every registered size of the featured image on the post payload.
		 *
		 * The previous implementation called wp_get_attachment_image_src(...)[0]
		 * unconditionally. For a post with no featured image that function
		 * returns `false`, so indexing it raised a PHP warning and wrote `null`
		 * into every size - which the front end then rendered as a <img> with no
		 * src. Bailing out early keeps the payload clean for the (common) case of
		 * a post without a thumbnail.
		 */
		function add_featured_image( $data, $post ) {
			if ( ! isset( $data->data ) || ! is_array( $data->data ) ) {
				return $data;
			}

			$thumbnail_id = get_post_thumbnail_id( $post->ID );

			if ( ! $thumbnail_id ) {
				return $data;
			}

			$sizes = [];

			foreach ( [ 'thumbnail', 'medium', 'large', 'full' ] as $size ) {
				$image            = wp_get_attachment_image_src( $thumbnail_id, $size );
				$sizes[ $size ] = is_array( $image ) && ! empty( $image[0] ) ? $image[0] : '';
			}

			$data->data['featured_image_url'] = $sizes;

			return $data;
		}

	}
endif;
