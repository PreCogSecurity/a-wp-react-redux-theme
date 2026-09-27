import React, {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {fetchPostsFromTax, getTaxIdFromSlug, ROUTER} from '../actions/index';

import Header from '../components/header';
import Main from '../components/main';
import Footer from '../components/footer';

class Category extends Component {
    componentWillMount() {
        this.props.getTaxIdFromSlug('tags', this.props.match.params.slug);
        this.props.dispatch({
            type: ROUTER,
            payload: this.props.match
        });
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.match.params.slug !== nextProps.match.params.slug) {
            this.props.getTaxIdFromSlug('tags', nextProps.match.params.slug);
        }

        // An unknown tag slug resolves to an empty array; guard before reading
        // `tags[0].id` off it.
        if (nextProps.tags.length && JSON.stringify(this.props.tags) !== JSON.stringify(nextProps.tags)) {
            this.props.fetchPostsFromTax('tags', nextProps.tags[0].id, nextProps.match.params.pageNum);
        }
        this.props.dispatch({
            type: ROUTER,
            payload: this.props.match
        });
    }

    componentDidUpdate() {
        let title = `${RT_API.siteName} - ${RT_API.siteDescription}`;
        if (this.props.tags.length) {
            title = `${this.props.tags[0].name} - ${RT_API.siteName}`;
        }
        document.title = title;
    }

    render() {
        return (
            <section className="container-fluid template-tag">
                <Header/>
                <Main/>
                <Footer/>
            </section>
        );
    }
}

function mapStateToProps({tags}) {
    return {tags};
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators(Object.assign({fetchPostsFromTax, getTaxIdFromSlug, dispatch}), dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Category)