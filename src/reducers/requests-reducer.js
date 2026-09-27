import {REQUEST_PENDING, REQUEST_SUCCEEDED, REQUEST_FAILED} from '../actions';

/**
 * Per-request lifecycle state, keyed by the `source` given to the action
 * creator (for example `fetchPosts` or `createComment`).
 *
 * Shape: `{[source]: {status, error}}` where `status` is one of
 * `REQUEST_PENDING`, `REQUEST_SUCCEEDED` or `REQUEST_FAILED` and `error` is the
 * sanitised `{message, status}` produced by `toSafeError` in the actions
 * module. It only ever contains a message and an HTTP status - never a raw
 * axios error, which would carry the `X-WP-Nonce` header.
 */
export default (state = {}, action) => {
    switch (action.type) {
        case REQUEST_PENDING:
        case REQUEST_SUCCEEDED:
        case REQUEST_FAILED:
            if (!action.source) {
                return state;
            }
            return {
                ...state,
                [action.source]: {
                    status: action.type,
                    error: action.type === REQUEST_FAILED ? (action.error || null) : null
                }
            };
    }
    return state;
}
