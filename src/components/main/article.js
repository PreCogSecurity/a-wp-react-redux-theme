import React, {Component} from 'react';

import Title from './article/title';
import Content from '../../containers/parts/content';
import Meta from './article/meta';
import PostFooter from '../../containers/parts/post-footer';

export default class Article extends Component {
	getClasses() {
		return this.props.isSingle ? 'card single w-75' : 'card archive';
	}

	getFeaturedImageSrc() {
		const urls = this.props.post.featured_image_url;

		if (!urls) {
			return '';
		}

		// `featured_image_url` maps a size to its URL, but a given size can be an
		// empty string when the image was never generated for it. Returning that
		// empty value (instead of the null it used to hand back) lets render()
		// drop the <img> entirely rather than emit one with no src.
		return (this.props.isSingle ? urls.large : urls.full) || '';
	}

	getCategories(cat_ids) {
		if ('undefined' !== typeof cat_ids) {
			return cat_ids.map(cat_id => {
				return RT_API['categories'].filter(cat => {
					return cat.term_id === cat_id
				})[0];
			});
		}
	}

	getContent(post, isSingle) {
		return (isSingle) ? post.content.rendered : post.excerpt.rendered;
	}

	render() {
		const post = this.props.post;
		const featuredImageSrc = this.getFeaturedImageSrc();

		return (
			<article className={this.getClasses()}>
				{featuredImageSrc && <img src={featuredImageSrc} className="card-img-top img-fluid"/>}
				<div className="card-block">
					<Title link={post.link} isSingle={this.props.isSingle}>
						{post.title.rendered}
					</Title>
					<Meta categories={this.getCategories(post.categories)}
						date={post.date}
						formattedDate={post.formatted_date}
						type={post.type}
						isSingle={this.props.isSingle}/>
					<Content isSingle={this.props.isSingle}>
						{this.getContent(post, this.props.isSingle)}
					</Content>
				</div>
				<PostFooter type={post.type} pId={post.id} isSingle={this.props.isSingle} tagIds={post.tags}
					commentStatus={post.comment_status}/>
			</article>
		);
	}
}