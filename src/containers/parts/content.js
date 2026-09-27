import React, {Component} from 'react';
import {withRouter} from 'react-router';

class Content extends Component {
	navigate(event) {
		if (event.target.tagName !== 'A') {
			return;
		}

		const href = event.target.getAttribute('href');

		// Links inside post content frequently have no `target` attribute, so
		// getAttribute() returns null here. Calling .toLowerCase() on that null
		// threw a TypeError that blanked out the whole post.
		const target = (event.target.getAttribute('target') || '').toLowerCase();

		if (!href) {
			return;
		}

		if ((href.includes(RT_API.baseUrl) || href.startsWith('/')) && '_blank' !== target) {
			event.preventDefault();
			this.props.history.push(href.replace(RT_API.baseUrl, ''));
		}
	}

	render() {
		return (<div
			className="card-text"
			dangerouslySetInnerHTML={{__html: this.props.children}}
			onClick={event => this.navigate(event)}/>);
	}
}

export default withRouter(Content);
