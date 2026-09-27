import axios from 'axios';

export const FETCH_POSTS = 'FETCH_POSTS';
export const FETCH_POST = 'FETCH_POST';
export const SEARCH_POSTS = 'SEARCH_POSTS';
export const CATEGORY_POSTS = 'CATEGORY_POSTS';
export const FETCH_CAT_INFO = 'FETCH_CAT_INFO';
export const FETCH_TAG_INFO = 'FETCH_TAG_INFO';
export const FETCH_MENU = 'FETCH_MENU';
export const FETCH_COMMENTS = 'FETCH_COMMENTS';
export const CREATE_COMMENT = 'CREATE_COMMENT';
export const ROUTER = 'ROUTER';

/**
 * Lifecycle actions used by `src/reducers/requests-reducer.js`.
 *
 * Every network call in this module brackets its work with these so the UI can
 * tell "still loading" from "it failed" - previously a failed WP-API request
 * left the UI permanently stuck on a spinner and the rejection was swallowed.
 */
export const REQUEST_PENDING = 'REQUEST_PENDING';
export const REQUEST_SUCCEEDED = 'REQUEST_SUCCEEDED';
export const REQUEST_FAILED = 'REQUEST_FAILED';

const WP_API_ENDPOINT = `${RT_API.root}wp/v2`;
const PRETTYPERMALINK_ENDPOINT = `${RT_API.root}react-theme/v1/prettyPermalink/`;
const MENU_ENDPOINT = `${RT_API.root}react-theme/v1/menu-locations/`;

/**
 * Input validation.
 *
 * Route params, query strings and form state all end up interpolated into REST
 * URLs or into a request body, so each of them is checked against an explicit
 * shape before it is used. Anything that does not match is rejected instead of
 * being passed through, which keeps a crafted `/search/<term>` or category slug
 * from smuggling extra query parameters or extra path segments into the WP API.
 */
const SLUG_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/i;
const MENU_LOCATION_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const ID_PATTERN = /^[0-9]{1,10}$/;
// Permalinks arrive as `location.pathname`, so they are always site-relative
// paths. Reject anything that could break out of the path segment.
const PERMALINK_PATTERN = /^\/[A-Za-z0-9\-._~%!$&'()*+,;=:@/]*$/;
const MAX_PERMALINK_LENGTH = 512;
const MAX_ID_LIST_LENGTH = 100;
const MAX_SEARCH_TERM_LENGTH = 200;
const MAX_AUTHOR_NAME_LENGTH = 250;
const MAX_AUTHOR_EMAIL_LENGTH = 254;
const MAX_COMMENT_CONTENT_LENGTH = 10000;

const DEFAULT_POST_TYPE = 'posts';
const DEFAULT_SEARCH_TERM = '';

class InvalidRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidRequestError';
    }
}

function isSafeSlug(value) {
    return typeof value === 'string' && SLUG_PATTERN.test(value);
}

/**
 * Coerce a value to a positive integer, or fall back. Used for page numbers,
 * which legitimately arrive as `undefined` from the router.
 */
function toPositiveInt(value, fallback) {
    if (typeof value === 'number' && isFinite(value)) {
        return Math.max(1, Math.floor(value));
    }
    const trimmed = (typeof value === 'string') ? value.trim() : '';
    if (!ID_PATTERN.test(trimmed)) {
        return fallback;
    }
    return Math.max(1, parseInt(trimmed, 10));
}

/**
 * Coerce a value to a non-negative object/term id, or `null` when it cannot be
 * trusted. Ids are never guessed - a request that needs a real id fails loudly.
 */
function toId(value) {
    const trimmed = (typeof value === 'string') ? value.trim() : value;
    if (typeof trimmed === 'number') {
        return (isFinite(trimmed) && trimmed >= 0) ? Math.floor(trimmed) : null;
    }
    if (typeof trimmed === 'string' && ID_PATTERN.test(trimmed)) {
        return parseInt(trimmed, 10);
    }
    return null;
}

function toIdList(value) {
    const candidates = Array.isArray(value)
        ? value
        : (typeof value === 'string' && value.length ? value.split(',') : []);
    const ids = [];
    for (let i = 0; i < candidates.length && ids.length < MAX_ID_LIST_LENGTH; i++) {
        const id = toId(candidates[i]);
        if (id === null) {
            return null;
        }
        ids.push(id);
    }
    return ids;
}

function toBoundedString(value, maxLength) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, maxLength);
}

/**
 * Validate a post type / taxonomy name. These are interpolated straight into a
 * URL path, so anything that is not a bare WordPress-style identifier is
 * rejected rather than escaped-and-hoped-for.
 */
function toSafeSlugOrThrow(value, fallback, label) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    if (!isSafeSlug(value)) {
        throw new InvalidRequestError(`Invalid ${label}.`);
    }
    return value;
}

/**
 * Detect C0/C1-style control characters without a control-character regex,
 * which `no-control-regex` (correctly) forbids.
 */
function hasControlCharacters(value) {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) {
            return true;
        }
    }
    return false;
}

function toSearchTermOrThrow(value) {
    if (value === undefined || value === null) {
        return DEFAULT_SEARCH_TERM;
    }
    if (typeof value !== 'string') {
        throw new InvalidRequestError('Invalid search term.');
    }
    const term = value.trim().slice(0, MAX_SEARCH_TERM_LENGTH);
    if (hasControlCharacters(term)) {
        throw new InvalidRequestError('Invalid search term.');
    }
    return term;
}

function toPermalinkOrThrow(value) {
    if (typeof value !== 'string' || value.length > MAX_PERMALINK_LENGTH) {
        throw new InvalidRequestError('Invalid permalink.');
    }
    if (!PERMALINK_PATTERN.test(value)) {
        throw new InvalidRequestError('Invalid permalink.');
    }
    if (value.split('/').indexOf('..') !== -1) {
        throw new InvalidRequestError('Invalid permalink.');
    }
    return value;
}

function toMenuLocationOrThrow(value) {
    if (typeof value !== 'string' || !MENU_LOCATION_PATTERN.test(value)) {
        throw new InvalidRequestError('Invalid menu location.');
    }
    return value;
}

/**
 * Whitelist the fields we are willing to send to `POST /wp/v2/comments`.
 *
 * The form state object is passed straight through by the comment form, so
 * without this an unexpected key (for example `status`) would be forwarded to
 * the WP API instead of being dropped.
 */
function toCommentPayloadOrThrow(params) {
    const source = (params && typeof params === 'object' && !Array.isArray(params)) ? params : {};
    const post = toId(source.post);
    const parent = (source.parent === undefined || source.parent === null) ? 0 : toId(source.parent);
    const authorName = toBoundedString(source.author_name, MAX_AUTHOR_NAME_LENGTH);
    const authorEmail = toBoundedString(source.author_email, MAX_AUTHOR_EMAIL_LENGTH);
    const content = toBoundedString(source.content, MAX_COMMENT_CONTENT_LENGTH);

    if (post === null || post < 1) {
        throw new InvalidRequestError('A valid post id is required to post a comment.');
    }
    if (parent === null) {
        throw new InvalidRequestError('Invalid parent comment id.');
    }
    if (!authorName) {
        throw new InvalidRequestError('A name is required to post a comment.');
    }
    if (!authorEmail || authorEmail.indexOf('@') === -1) {
        throw new InvalidRequestError('A valid email address is required to post a comment.');
    }
    if (!content) {
        throw new InvalidRequestError('A comment body is required.');
    }

    return {
        post: post,
        parent: parent,
        author_name: authorName,
        author_email: authorEmail,
        content: content
    };
}

/**
 * Turn an axios rejection into something safe to hand to a reducer and render.
 *
 * The raw error is deliberately *not* forwarded: `error.config.headers` carries
 * the `X-WP-Nonce` value and `error.response` can carry arbitrary server
 * output, none of which belongs in Redux state (or in a stack trace in the UI).
 */
function toSafeError(error) {
    const response = (error && error.response) ? error.response : null;
    const data = response ? response.data : null;
    const status = (response && typeof response.status === 'number') ? response.status : 0;

    let message = 'The request could not be completed.';
    if (data && typeof data.message === 'string' && data.message) {
        message = data.message;
    } else if (error && typeof error.message === 'string' && error.message) {
        message = error.message;
    }

    return {message: message, status: status};
}

/**
 * Run a network call, publishing its lifecycle to the store.
 *
 * `run` is invoked synchronously (so the request is issued during the dispatch,
 * exactly as before) and whatever it returns is settled here: a rejection - or
 * a synchronous throw from input validation - becomes a `REQUEST_FAILED`
 * action instead of an unhandled promise rejection.
 */
function dispatchRequest(dispatch, source, run) {
    dispatch({type: REQUEST_PENDING, source: source});

    let pending;
    try {
        pending = run();
    } catch (error) {
        pending = Promise.reject(error);
    }

    return Promise.resolve(pending)
        .then(() => {
            dispatch({type: REQUEST_SUCCEEDED, source: source});
        })
        .catch(error => {
            dispatch({type: REQUEST_FAILED, source: source, error: toSafeError(error)});
        });
}

export function fetchPosts(pageNum = 1, post_type = DEFAULT_POST_TYPE) {
    return function (dispatch) {
        return dispatchRequest(dispatch, 'fetchPosts', () => {
            const postType = toSafeSlugOrThrow(post_type, DEFAULT_POST_TYPE, 'post type');
            const page = toPositiveInt(pageNum, 1);
            return axios.get(`${WP_API_ENDPOINT}/${postType}?_embed`, {params: {page: page}})
                .then(response => {
                    dispatch({
                        type: FETCH_POSTS,
                        payload: response.data
                    });
                });
        });
    };
}

export function fetchPostsFromTax(tax = 'categories', taxId = 0, pageNum = 1, post_type = DEFAULT_POST_TYPE) {
    return function (dispatch) {
        return dispatchRequest(dispatch, 'fetchPostsFromTax', () => {
            const taxonomy = toSafeSlugOrThrow(tax, 'categories', 'taxonomy');
            const postType = toSafeSlugOrThrow(post_type, DEFAULT_POST_TYPE, 'post type');
            const id = toId(taxId);
            if (id === null) {
                throw new InvalidRequestError('Invalid taxonomy id.');
            }
            // `_embed` carries no user input, so it stays a literal query
            // fragment; every variable part goes through axios' serialiser.
            const params = {page: toPositiveInt(pageNum, 1)};
            params[taxonomy] = id;

            return axios.get(`${WP_API_ENDPOINT}/${postType}?_embed`, {params: params})
                .then(response => {
                    dispatch({
                        type: CATEGORY_POSTS,
                        payload: response.data
                    });
                });
        });
    };
}

export function getTaxIdFromSlug(tax, slug) {
    return function (dispatch) {
        return dispatchRequest(dispatch, 'getTaxIdFromSlug', () => {
            const taxonomy = toSafeSlugOrThrow(tax, 'categories', 'taxonomy');
            if (typeof slug !== 'string' || !slug.trim().length) {
                throw new InvalidRequestError('Invalid taxonomy slug.');
            }

            return axios.get(`${WP_API_ENDPOINT}/${taxonomy}`, {params: {slug: slug}})
                .then(response => {
                    switch (taxonomy) {
                        case "tags":
                            dispatch({
                                type: FETCH_TAG_INFO,
                                payload: response.data
                            });
                            break;
                        case "categories":
                            dispatch({
                                type: FETCH_CAT_INFO,
                                payload: response.data
                            });
                            break;
                    }
                });
        });
    };
}

export function fetchPost(prettyPermalink) {
    return function (dispatch) {
        return dispatchRequest(dispatch, 'fetchPost', () => {
            const permalink = toPermalinkOrThrow(prettyPermalink);

            return axios.get(`${PRETTYPERMALINK_ENDPOINT}${permalink}`)
                .then(response => {
                    dispatch({
                        type: FETCH_POST,
                        payload: [response.data]
                    });
                });
        });
    };
}

export function fetchTaxInfo(tax, tagIds) {
    return function (dispatch) {
        return dispatchRequest(dispatch, 'fetchTaxInfo', () => {
            const taxonomy = toSafeSlugOrThrow(tax, 'tags', 'taxonomy');
            const ids = toIdList(tagIds);
            if (ids === null || !ids.length) {
                throw new InvalidRequestError('Invalid tag ids.');
            }

            return axios.get(`${WP_API_ENDPOINT}/${taxonomy}/`, {params: {include: ids.join(',')}})
                .then(response => {
                    dispatch({
                        type: FETCH_TAG_INFO,
                        payload: response.data
                    });
                });
        });
    };
}

export function fetchMenu(menu) {
    return function (dispatch) {
        return dispatchRequest(dispatch, 'fetchMenu', () => {
            const location = toMenuLocationOrThrow(menu);

            return axios.get(`${MENU_ENDPOINT}${encodeURIComponent(location)}`)
                .then(response => {
                    dispatch({
                        type: FETCH_MENU,
                        payload: {items: response.data, name: location}
                    });
                });
        });
    };
}

export function searchSite(term, post_type = DEFAULT_POST_TYPE) {
    return function (dispatch) {
        return dispatchRequest(dispatch, 'searchSite', () => {
            const postType = toSafeSlugOrThrow(post_type, DEFAULT_POST_TYPE, 'post type');
            const searchTerm = toSearchTermOrThrow(term);

            return axios.get(`${WP_API_ENDPOINT}/${postType}?_embed`, {params: {search: searchTerm}})
                .then(response => {
                    dispatch({
                        type: SEARCH_POSTS,
                        payload: response.data
                    });
                });
        });
    };
}

export function fetchComments(postId) {
    return function (dispatch) {
        return dispatchRequest(dispatch, 'fetchComments', () => {
            const id = toId(postId);
            if (id === null || id < 1) {
                throw new InvalidRequestError('Invalid post id.');
            }

            return axios.get(`${WP_API_ENDPOINT}/comments`, {
                params: {post: id, orderby: 'parent', per_page: 100}
            })
                .then(response => {
                    dispatch({
                        type: FETCH_COMMENTS,
                        payload: response.data
                    });
                });
        });
    };
}

/**
 * `source` is the key the request lifecycle is recorded under. `createComment`
 * accepts a custom one because the post page can render several comment forms
 * (the article form plus one per reply toggle) and each needs its own status
 * rather than flipping every form at once.
 */
export function createComment(params = {post: 0, parent: 0, author_name: '', author_email: '', content: ''}, source = 'createComment') {
    return function (dispatch) {
        return dispatchRequest(dispatch, source, () => {
            const payload = toCommentPayloadOrThrow(params);

            return axios({
                method: 'post',
                url: `${WP_API_ENDPOINT}/comments`,
                headers: {
                    'X-WP-Nonce': RT_API.nonce,
                    'Content-Type': 'application/json'
                },
                data: payload
            })
                .then(response => {
                    dispatch({
                        type: CREATE_COMMENT,
                        payload: response.data
                    });
                });
        });
    };
}
