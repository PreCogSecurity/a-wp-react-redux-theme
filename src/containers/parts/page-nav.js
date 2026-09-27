import React, {Component} from 'react';
import {Link} from 'react-router-dom';
import {connect} from 'react-redux';

class PageNav extends Component {
    getParams() {
        // `routerMatch` is seeded with `[]`, so `params` is undefined until a
        // ROUTER action lands. Reading through it blindly threw a TypeError.
        const routerMatch = this.props.routerMatch || {};
        return routerMatch.params || {};
    }

    getPageNum() {
        const pageNum = parseInt(this.getParams().pageNum, 10);
        return (isNaN(pageNum) || pageNum < 1) ? 1 : pageNum;
    }

    getPrevPage() {
        const pageNum = this.getPageNum();
        return (pageNum > 2) ? `${this.getSlug()}/page/${pageNum - 1}/` : `/`;
    }

    getSlug() {
        const params = this.getParams();
        const slug = params.slug || params.term;

        // No taxonomy in the URL (blog index, search): there is no slug to build,
        // and the caller falls back to the site-root paging route. Returning
        // "/category/undefined" here used to produce a dead "Next" link.
        if (!slug) {
            return "";
        }

        let tax = 'category';
        const urlParts = ((this.props.routerMatch || {}).url || "")
            .split('/')
            .filter(part => "" !== part && slug !== part);

        if (urlParts.length) {
            tax = urlParts[0];
        }

        return `/${tax}/${slug}`;
    }

    getNextPage() {
        const pageNum = this.getPageNum();
        const slug = this.getSlug();

        return slug ? `${slug}/page/${pageNum + 1}/` : `/page/${pageNum + 1}/`;
    }

    render() {
        if (this.props.shouldRender) {
            return (
                <div className="nav justify-content-center">
                    <div className="nav-item">
                        {(1 < this.getPageNum()) ?
                            <Link to={this.getPrevPage()} className="nav-link btn btn-primary">Previous</Link> : ''}
                    </div>
                    &nbsp;
                    <div className="nav-item">
                        <Link to={this.getNextPage()} className="nav-link btn btn-primary">Next</Link>
                    </div>
                </div>
            );
        } else {
            return <span/>;
        }
    }
}

function mapStateToProps({routerMatch}) {
    return {routerMatch};
}

export default connect(mapStateToProps)(PageNav);
