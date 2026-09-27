import axios from 'axios';

import {
    fetchPosts,
    fetchPostsFromTax,
    getTaxIdFromSlug,
    fetchPost,
    fetchTaxInfo,
    fetchMenu,
    searchSite,
    fetchComments,
    createComment,
    FETCH_POSTS,
    FETCH_POST,
    SEARCH_POSTS,
    CATEGORY_POSTS,
    FETCH_CAT_INFO,
    FETCH_TAG_INFO,
    FETCH_MENU,
    FETCH_COMMENTS,
    CREATE_COMMENT,
    REQUEST_PENDING,
    REQUEST_SUCCEEDED,
    REQUEST_FAILED
} from '../src/actions';

jest.mock('axios');

const WP = RT_API.root + 'wp/v2';

let dispatch;

beforeEach(() => {
    dispatch = jest.fn();
    jest.clearAllMocks();
});

function resolveWith(data) {
    return Promise.resolve({data: data});
}

function rejectWith(error) {
    return Promise.reject(error);
}

function typesDispatched() {
    return dispatch.mock.calls.map(call => call[0].type);
}

function lastActionOfType(type) {
    const matches = dispatch.mock.calls.map(call => call[0]).filter(action => action.type === type);
    return matches.length ? matches[matches.length - 1] : null;
}

describe('request lifecycle', () => {
    it('brackets a successful request with PENDING then SUCCEEDED', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return fetchPosts(2)(dispatch).then(() => {
            expect(typesDispatched()).toEqual([REQUEST_PENDING, FETCH_POSTS, REQUEST_SUCCEEDED]);
        });
    });

    it('turns a rejected request into REQUEST_FAILED instead of an unhandled rejection', () => {
        axios.get.mockReturnValue(rejectWith({message: 'Network Error'}));

        return fetchPosts()(dispatch).then(() => {
            const failure = lastActionOfType(REQUEST_FAILED);
            expect(failure).not.toBeNull();
            expect(failure.source).toBe('fetchPosts');
            expect(failure.error).toEqual({message: 'Network Error', status: 0});
        });
    });

    it('prefers the server supplied error message and status', () => {
        axios.get.mockReturnValue(rejectWith({
            response: {status: 503, data: {message: 'Service Unavailable'}}
        }));

        return fetchMenu('main_menu')(dispatch).then(() => {
            expect(lastActionOfType(REQUEST_FAILED).error)
                .toEqual({message: 'Service Unavailable', status: 503});
        });
    });

    it('never leaks the raw axios error (and its X-WP-Nonce header) into the store', () => {
        const sensitive = {
            config: {headers: {'X-WP-Nonce': 'super-secret-nonce'}},
            stack: 'Error: boom\n    at leak.js:1',
            response: {status: 500, data: {message: 'Boom'}}
        };
        axios.get.mockReturnValue(rejectWith(sensitive));

        return fetchPosts()(dispatch).then(() => {
            const failure = lastActionOfType(REQUEST_FAILED);
            expect(failure.error).toEqual({message: 'Boom', status: 500});
            expect(failure.error.config).toBeUndefined();
            expect(failure.error.stack).toBeUndefined();
            expect(JSON.stringify(failure)).not.toContain('super-secret-nonce');
        });
    });

    it('fails closed with REQUEST_FAILED when a handler throws synchronously', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return fetchPostsFromTax('categories', 'not-an-id')(dispatch).then(() => {
            expect(axios.get).not.toHaveBeenCalled();
            expect(lastActionOfType(REQUEST_FAILED).error.message).toBe('Invalid taxonomy id.');
        });
    });
});

describe('fetchPosts', () => {
    it('dispatches FETCH_POSTS with the response body', () => {
        const payload = [{id: 1}];
        axios.get.mockReturnValue(resolveWith(payload));

        return fetchPosts(3)(dispatch).then(() => {
            expect(lastActionOfType(FETCH_POSTS).payload).toBe(payload);
            expect(axios.get).toHaveBeenCalledWith(`${WP}/posts?_embed`, {params: {page: 3}});
        });
    });

    it('defaults to page 1 and rejects a path-traversing post type', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return fetchPosts()(dispatch)
            .then(() => {
                expect(axios.get).toHaveBeenCalledWith(`${WP}/posts?_embed`, {params: {page: 1}});
                return fetchPosts(1, '../../wp-admin')(dispatch);
            })
            .then(() => {
                expect(lastActionOfType(REQUEST_FAILED).error.message).toBe('Invalid post type.');
            });
    });

    it('clamps a non numeric page number instead of forwarding NaN', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return fetchPosts('abc')(dispatch).then(() => {
            expect(axios.get).toHaveBeenCalledWith(`${WP}/posts?_embed`, {params: {page: 1}});
        });
    });
});

describe('fetchPostsFromTax', () => {
    it('passes the taxonomy term as an encoded query parameter', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return fetchPostsFromTax('categories', 7, 2, 'pages')(dispatch).then(() => {
            expect(axios.get).toHaveBeenCalledWith(`${WP}/pages?_embed`, {
                params: {page: 2, categories: 7}
            });
            expect(lastActionOfType(CATEGORY_POSTS)).not.toBeNull();
        });
    });

    it('refuses a taxonomy name that would inject extra path segments', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return fetchPostsFromTax('categories?per_page=999', 1)(dispatch).then(() => {
            expect(axios.get).not.toHaveBeenCalled();
            expect(lastActionOfType(REQUEST_FAILED).error.message).toBe('Invalid taxonomy.');
        });
    });
});

describe('getTaxIdFromSlug', () => {
    it('maps a tag slug onto FETCH_TAG_INFO', () => {
        axios.get.mockReturnValue(resolveWith([{id: 4}]));

        return getTaxIdFromSlug('tags', 'security')(dispatch).then(() => {
            expect(axios.get).toHaveBeenCalledWith(`${WP}/tags`, {params: {slug: 'security'}});
            expect(lastActionOfType(FETCH_TAG_INFO).payload).toEqual([{id: 4}]);
        });
    });

    it('maps a category slug onto FETCH_CAT_INFO', () => {
        axios.get.mockReturnValue(resolveWith([{id: 5}]));

        return getTaxIdFromSlug('categories', 'news')(dispatch).then(() => {
            expect(lastActionOfType(FETCH_CAT_INFO).payload).toEqual([{id: 5}]);
            expect(lastActionOfType(FETCH_TAG_INFO)).toBeNull();
        });
    });

    it('rejects an empty slug', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return getTaxIdFromSlug('tags', '   ')(dispatch).then(() => {
            expect(axios.get).not.toHaveBeenCalled();
            expect(lastActionOfType(REQUEST_FAILED).error.message).toBe('Invalid taxonomy slug.');
        });
    });
});

describe('fetchPost', () => {
    it('wraps the single post in an array and preserves the leading slash', () => {
        const post = {id: 11};
        axios.get.mockReturnValue(resolveWith(post));

        return fetchPost('/hello-world/')(dispatch).then(() => {
            expect(axios.get).toHaveBeenCalledWith(`${RT_API.root}react-theme/v1/prettyPermalink//hello-world/`);
            expect(lastActionOfType(FETCH_POST).payload).toEqual([post]);
        });
    });

    it.each([
        ['a traversal attempt', '/../../wp-admin/'],
        ['an absolute url', 'https://evil.test/steal'],
        ['an oversized path', '/' + 'a'.repeat(600)]
    ])('rejects %s', (label, permalink) => {
        axios.get.mockReturnValue(resolveWith({}));

        return fetchPost(permalink)(dispatch).then(() => {
            expect(axios.get).not.toHaveBeenCalled();
            expect(lastActionOfType(REQUEST_FAILED).error.message).toBe('Invalid permalink.');
        });
    });
});

describe('fetchTaxInfo', () => {
    it('joins tag ids into the include parameter', () => {
        axios.get.mockReturnValue(resolveWith([{id: 1}, {id: 2}]));

        return fetchTaxInfo('tags', [1, 2])(dispatch).then(() => {
            expect(axios.get).toHaveBeenCalledWith(`${WP}/tags/`, {params: {include: '1,2'}});
            expect(lastActionOfType(FETCH_TAG_INFO)).not.toBeNull();
        });
    });

    it('accepts the comma separated form and rejects a non numeric id', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return fetchTaxInfo('tags', '3,4')(dispatch)
            .then(() => {
                expect(axios.get).toHaveBeenCalledWith(`${WP}/tags/`, {params: {include: '3,4'}});
                return fetchTaxInfo('tags', [1, 'x'])(dispatch);
            })
            .then(() => {
                expect(lastActionOfType(REQUEST_FAILED).error.message).toBe('Invalid tag ids.');
            });
    });
});

describe('fetchMenu', () => {
    it('records the requested location alongside the items', () => {
        const items = [{ID: 3, title: 'Home', url: 'https://theme.test/'}];
        axios.get.mockReturnValue(resolveWith(items));

        return fetchMenu('main_menu')(dispatch).then(() => {
            expect(axios.get).toHaveBeenCalledWith(`${RT_API.root}react-theme/v1/menu-locations/main_menu`);
            expect(lastActionOfType(FETCH_MENU).payload).toEqual({items: items, name: 'main_menu'});
        });
    });

    it('rejects a location that would traverse the route', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return fetchMenu('main_menu/../../secret')(dispatch).then(() => {
            expect(axios.get).not.toHaveBeenCalled();
            expect(lastActionOfType(REQUEST_FAILED).error.message).toBe('Invalid menu location.');
        });
    });
});

describe('searchSite', () => {
    it('encodes the search term instead of splicing it into the query string', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return searchSite('cats & dogs')(dispatch).then(() => {
            expect(axios.get).toHaveBeenCalledWith(`${WP}/posts?_embed`, {params: {search: 'cats & dogs'}});
        });
    });

    it('truncates an absurdly long term and rejects control characters', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return searchSite('a'.repeat(500))(dispatch)
            .then(() => {
                expect(axios.get.mock.calls[0][1].params.search).toHaveLength(200);
                return searchSite('ok\u0000bad')(dispatch);
            })
            .then(() => {
                expect(lastActionOfType(REQUEST_FAILED).error.message).toBe('Invalid search term.');
            });
    });

    it('dispatches SEARCH_POSTS with the result', () => {
        const payload = [{id: 9}];
        axios.get.mockReturnValue(resolveWith(payload));

        return searchSite('redux')(dispatch).then(() => {
            expect(lastActionOfType(SEARCH_POSTS).payload).toBe(payload);
        });
    });
});

describe('fetchComments', () => {
    it('requests the threaded comment list for a post', () => {
        const comments = [{id: 1, parent: 0}];
        axios.get.mockReturnValue(resolveWith(comments));

        return fetchComments(42)(dispatch).then(() => {
            expect(axios.get).toHaveBeenCalledWith(`${WP}/comments`, {
                params: {post: 42, orderby: 'parent', per_page: 100}
            });
            expect(lastActionOfType(FETCH_COMMENTS).payload).toBe(comments);
        });
    });

    it('rejects a missing or non numeric post id', () => {
        axios.get.mockReturnValue(resolveWith([]));

        return fetchComments(undefined)(dispatch)
            .then(() => {
                expect(axios.get).not.toHaveBeenCalled();
                expect(lastActionOfType(REQUEST_FAILED).error.message).toBe('Invalid post id.');
            });
    });
});

describe('createComment', () => {
    const valid = {
        post: '42',
        parent: '0',
        author_name: '  Ada Lovelace  ',
        author_email: ' ada@example.test ',
        content: ' Nice write-up. '
    };

    it('posts a normalised, whitelisted payload with the REST nonce', () => {
        const created = {id: 7, status: 'hold'};
        axios.mockReturnValue(resolveWith(created));

        return createComment(valid)(dispatch).then(() => {
            expect(axios).toHaveBeenCalledWith({
                method: 'post',
                url: `${WP}/comments`,
                headers: {
                    'X-WP-Nonce': RT_API.nonce,
                    'Content-Type': 'application/json'
                },
                data: {
                    post: 42,
                    parent: 0,
                    author_name: 'Ada Lovelace',
                    author_email: 'ada@example.test',
                    content: 'Nice write-up.'
                }
            });
            expect(lastActionOfType(CREATE_COMMENT).payload).toBe(created);
        });
    });

    it('drops fields that the form does not own instead of forwarding them', () => {
        axios.mockReturnValue(resolveWith({id: 8}));

        return createComment(Object.assign({}, valid, {
            status: 'approve',
            user_id: 1,
            posted: true
        }))(dispatch).then(() => {
            const data = axios.mock.calls[0][0].data;
            expect(Object.keys(data).sort()).toEqual([
                'author_email', 'author_name', 'content', 'parent', 'post'
            ]);
            expect(data.status).toBeUndefined();
            expect(data.user_id).toBeUndefined();
        });
    });

    it('records a moderation rejection so the form can stay open', () => {
        axios.mockReturnValue(rejectWith({
            response: {status: 403, data: {message: 'Sorry, you are not allowed to do that.'}}
        }));

        return createComment(valid)(dispatch).then(() => {
            const failure = lastActionOfType(REQUEST_FAILED);
            expect(failure.source).toBe('createComment');
            expect(failure.error).toEqual({
                message: 'Sorry, you are not allowed to do that.',
                status: 403
            });
            expect(lastActionOfType(CREATE_COMMENT)).toBeNull();
        });
    });

    it('tracks each form separately when given a custom source', () => {
        axios.mockReturnValue(resolveWith({id: 9}));

        return createComment(valid, 'createComment:42:7')(dispatch).then(() => {
            expect(lastActionOfType(REQUEST_SUCCEEDED).source).toBe('createComment:42:7');
        });
    });

    it.each([
        ['a missing post id', {post: 0}, 'A valid post id is required to post a comment.'],
        ['a blank name', Object.assign({}, valid, {author_name: '   '}), 'A name is required to post a comment.'],
        ['a malformed email', Object.assign({}, valid, {author_email: 'nope'}), 'A valid email address is required to post a comment.'],
        ['a blank body', Object.assign({}, valid, {content: ''}), 'A comment body is required.'],
        ['a non numeric parent', Object.assign({}, valid, {parent: 'root'}), 'Invalid parent comment id.']
    ])('refuses to send %s', (label, params, message) => {
        axios.mockReturnValue(resolveWith({id: 10}));

        return createComment(params)(dispatch).then(() => {
            expect(axios).not.toHaveBeenCalled();
            expect(lastActionOfType(REQUEST_FAILED).error.message).toBe(message);
        });
    });

    it('caps the comment body length', () => {
        axios.mockReturnValue(resolveWith({id: 11}));

        return createComment(Object.assign({}, valid, {content: 'x'.repeat(20000)}))(dispatch).then(() => {
            expect(axios.mock.calls[0][0].data.content).toHaveLength(10000);
        });
    });
});
