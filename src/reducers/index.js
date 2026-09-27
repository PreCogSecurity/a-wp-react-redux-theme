import {combineReducers} from 'redux';

import posts from './posts-reducer';
import menu from './menu-reducer';
import tags from './tag-reducer';
import cat from './cat-reducer';
import comments from './comments-reducer';
import routerMatch from './routerMatch-reducer';
import requests from './requests-reducer';

export default combineReducers({
    posts,
    menu,
    tags,
    cat,
    comments,
    routerMatch,
    requests
});
