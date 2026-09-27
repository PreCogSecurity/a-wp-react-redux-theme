import React, {Component} from 'react';
import {connect} from 'react-redux';
import {createComment, REQUEST_FAILED, REQUEST_PENDING, REQUEST_SUCCEEDED} from '../../actions';

/**
 * A post page renders several comment forms (the article form plus one per
 * "Reply" toggle), so each form needs its own key in `state.requests` - sharing
 * one key would flip every form to "thank you" as soon as any one of them
 * succeeded.
 */
export function commentRequestKey(pId, replyCommentId) {
    return `createComment:${pId}:${replyCommentId || 0}`;
}

class CommentForm extends Component {
    constructor(props) {
        super(props);
        this.state = {
            author_name: '',
            author_email: '',
            content: ''
        };
    }

    submitComment(event) {
        event.preventDefault();
        this.props.createComment({
            post: this.props.pId,
            parent: this.props.replyCommentId || 0,
            author_name: this.state.author_name,
            author_email: this.state.author_email,
            content: this.state.content
        }, commentRequestKey(this.props.pId, this.props.replyCommentId));
    }

    formInputChange(event) {
        this.setState({[event.target.name]: event.target.value});
    }

    getStatus() {
        const request = this.props.request;
        return request ? request.status : null;
    }

    renderError() {
        const request = this.props.request || {};
        if (REQUEST_FAILED !== request.status) {
            return null;
        }
        const message = (request.error && request.error.message)
            ? request.error.message
            : 'Your comment could not be submitted. Please try again.';
        return <div className="alert alert-danger" role="alert">{message}</div>;
    }

    renderForm() {
        const pending = REQUEST_PENDING === this.getStatus();

        return <form className="commentBox bg-faded" onSubmit={this.submitComment.bind(this)}>
            <h4>Leave a Reply</h4>
            {this.renderError()}
            <div className="form-group">
                <textarea className="form-control" id="exampleTextarea" rows="3" name="content" required="required"
                          placeholder="Enter your comment here..." onChange={this.formInputChange.bind(this)}
                          value={this.state.content}></textarea>
            </div>
            <div className="form-group">
                <input type="text" className="form-control" aria-describedby="name"
                       placeholder="Name (required)" required="required" name="author_name"
                       onChange={this.formInputChange.bind(this)}
                       value={this.state.author_name}/>
            </div>
            <div className="form-group">
                <input type="email" className="form-control" aria-describedby="email"
                       placeholder="Email (required)" required="required" name="author_email"
                       onChange={this.formInputChange.bind(this)}
                       value={this.state.author_email}/>
            </div>
            <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? 'Submitting...' : 'Submit'}
            </button>
        </form>
    }

    render() {
        return REQUEST_SUCCEEDED === this.getStatus()
            ? <div className="commentBox bg-faded">Thank you for your comment. A moderator will review it shortly.</div>
            : this.renderForm();
    }
}

function mapStateToProps(state, ownProps) {
    return {request: (state.requests || {})[commentRequestKey(ownProps.pId, ownProps.replyCommentId)]};
}

export default connect(mapStateToProps, {createComment})(CommentForm);
