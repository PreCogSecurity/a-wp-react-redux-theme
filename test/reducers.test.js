import rootReducer from '../src/reducers';
import posts from '../src/reducers/posts-reducer';
import menu from '../src/reducers/menu-reducer';
import tags from '../src/reducers/tag-reducer';
import cat from '../src/reducers/cat-reducer';
import comments from '../src/reducers/comments-reducer';
import routerMatch from '../src/reducers/routerMatch-reducer';
import requests from '../src/reducers/requests-reducer';

import {
    FETCH_POSTS,
    FETCH_POST,
    SEARCH_POSTS,
    CATEGORY_POSTS,
    FETCH_CAT_INFO,
    FETCH_TAG_INFO,
    FETCH_MENU,
    FETCH_COMMENTS,
    CREATE_COMMENT,
    ROUTER,
    REQUEST_PENDING,
    REQUEST_SUCCEEDED,
    REQUEST_FAILED
} from '../src/actions';

const UNKNOWN = {type: '@@INIT/IRRELEVANT_ACTION'};

describe('posts reducer', () => {
    const seeds = [
        [FETCH_POSTS, 'FETCH_POSTS'],
        [FETCH_POST, 'FETCH_POST'],
        [SEARCH_POSTS, 'SEARCH_POSTS'],
        [CATEGORY_POSTS, 'CATEGORY_POSTS']
    ];

    it.each(seeds)('adopts the payload on %s', (type) => {
        const payload = [{id: 1, title: {rendered: 'Hi'}}];
        expect(posts([], {type: type, payload: payload})).toBe(payload);
    });

    it('defaults to an empty list', () => {
        expect(posts(undefined, UNKNOWN)).toEqual([]);
    });

    it('ignores unrelated actions', () => {
        const state = [{id: 1}];
        expect(posts(state, UNKNOWN)).toBe(state);
    });
});

describe('menu reducer', () => {
    it('defaults to an empty, named menu', () => {
        expect(menu(undefined, UNKNOWN)).toEqual({name: '', items: []});
    });

    it('stores the location name together with its items', () => {
        const payload = {items: [{ID: 1}], name: 'main_menu'};
        expect(menu(undefined, {type: FETCH_MENU, payload: payload})).toBe(payload);
    });
});

describe('taxonomy reducers', () => {
    it('stores tag info', () => {
        const payload = [{id: 3, name: 'security'}];
        expect(tags(undefined, {type: FETCH_TAG_INFO, payload: payload})).toBe(payload);
        expect(cat(undefined, {type: FETCH_TAG_INFO, payload: payload})).toEqual([]);
    });

    it('stores category info', () => {
        const payload = [{id: 4, name: 'news'}];
        expect(cat(undefined, {type: FETCH_CAT_INFO, payload: payload})).toBe(payload);
        expect(tags(undefined, {type: FETCH_CAT_INFO, payload: payload})).toEqual([]);
    });
});

describe('comments reducer', () => {
    it('stores the fetched comments', () => {
        const payload = [{id: 1, parent: 0}];
        expect(comments(undefined, {type: FETCH_COMMENTS, payload: payload})).toBe(payload);
    });

    it('leaves the list alone after a comment is created (awaiting moderation)', () => {
        const state = [{id: 1, parent: 0}];
        expect(comments(state, {type: CREATE_COMMENT, payload: {id: 2}})).toBe(state);
    });
});

describe('routerMatch reducer', () => {
    it('stores the router match', () => {
        const payload = {url: '/tag/security', params: {slug: 'security'}};
        expect(routerMatch(undefined, {type: ROUTER, payload: payload})).toBe(payload);
    });
});

describe('requests reducer', () => {
    it('defaults to an empty map', () => {
        expect(requests(undefined, UNKNOWN)).toEqual({});
    });

    it('tracks a request through its lifecycle', () => {
        let state = requests(undefined, {type: REQUEST_PENDING, source: 'fetchPosts'});
        expect(state.fetchPosts).toEqual({status: REQUEST_PENDING, error: null});

        state = requests(state, {type: REQUEST_SUCCEEDED, source: 'fetchPosts'});
        expect(state.fetchPosts).toEqual({status: REQUEST_SUCCEEDED, error: null});
    });

    it('records the sanitised failure and clears the error on the next attempt', () => {
        const error = {message: 'Service Unavailable', status: 503};
        let state = requests(undefined, {type: REQUEST_FAILED, source: 'createComment', error: error});
        expect(state.createComment).toEqual({status: REQUEST_FAILED, error: error});

        state = requests(state, {type: REQUEST_PENDING, source: 'createComment'});
        expect(state.createComment).toEqual({status: REQUEST_PENDING, error: null});
    });

    it('falls back to a null error when a failure arrives without one', () => {
        const state = requests(undefined, {type: REQUEST_FAILED, source: 'fetchMenu'});
        expect(state.fetchMenu).toEqual({status: REQUEST_FAILED, error: null});
    });

    it('tracks concurrent requests under their own keys', () => {
        let state = requests(undefined, {type: REQUEST_PENDING, source: 'createComment:42:0'});
        state = requests(state, {type: REQUEST_SUCCEEDED, source: 'createComment:42:0'});
        state = requests(state, {type: REQUEST_PENDING, source: 'createComment:42:7'});

        expect(state['createComment:42:0'].status).toBe(REQUEST_SUCCEEDED);
        expect(state['createComment:42:7'].status).toBe(REQUEST_PENDING);
    });

    it('ignores a lifecycle action with no source', () => {
        const state = {fetchPosts: {status: REQUEST_SUCCEEDED, error: null}};
        expect(requests(state, {type: REQUEST_FAILED, error: {message: 'x', status: 500}})).toBe(state);
    });
});

describe('root reducer', () => {
    it('exposes every slice the containers read from', () => {
        expect(Object.keys(rootReducer(undefined, UNKNOWN)).sort()).toEqual([
            'cat', 'comments', 'menu', 'posts', 'requests', 'routerMatch', 'tags'
        ]);
    });

    it('builds up state from a ROUTER action and a request lifecycle', () => {
        const state = rootReducer(undefined, {type: ROUTER, payload: {url: '/', params: {}}});
        expect(state.routerMatch).toEqual({url: '/', params: {}});

        const withPosts = rootReducer(state, {type: FETCH_POSTS, payload: [{id: 1}]});
        expect(withPosts.posts).toEqual([{id: 1}]);

        const withRequest = rootReducer(withPosts, {type: REQUEST_FAILED, source: 'fetchPosts', error: {message: 'nope', status: 500}});
        expect(withRequest.requests.fetchPosts.error.message).toBe('nope');
    });
});
