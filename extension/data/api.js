/**
 * Generic helpers for making requests against the Reddit API.
 */

import browser from 'webextension-polyfill';


/**
 * Sends a generic HTTP request through the background page.
 * @function
 * @param {object} options The options for the AJAX request
 * @param {string} options.endpoint The endpoint to request
 * @param {string} [options.method] The HTTP method to use for the request
 * @param {object} [options.query] Query parameters as an object
 * @param {string} [options.body] Body to send with a POST request, serialized
 * as JSON if not a string
 * @param {boolean?} [options.oauth] If true, the request will be sent on
 * oauth.reddit.com, and the `Authorization` header will be set with the
 * OAuth access token for the logged-in user
 * @param {boolean?} [options.okOnly] If true, non-2xx responses will result
 * in an error being rejected. The error will have a `response` property
 * containing the full `Response` object.
 * @returns {Promise} Resolves to a `Response` object or rejects an `Error`.
 */
export const sendRequest = async ({
    method,
    endpoint,
    query,
    body,
    oauth,
    okOnly,
}) => {
    // Make the request
    const messageReply = await browser.runtime.sendMessage({
        action: 'tb-request',
        method,
        endpoint,
        query,
        body,
        oauth,
        okOnly,
    });

    // The reply from that message will always be an object. It can have these keys:
    // - `error` (true if the request failed, otherwise not present)
    // - `message` (present only with `error`, a string error message)
    // - `response` (response data as an array of arguments to `Response()`)

    if (messageReply.error) {
        // If we get an error, we want to throw an `Error` object.
        const error = new Error(messageReply.message);
        // If we get a response as well, we attach it to the error.
        if (messageReply.response) {
            error.response = new Response(...messageReply.response);
        }
        throw error;
    } else {
        // If we didn't get an error, then we return a `Response`.
        return new Response(...messageReply.response);
    }
};

/**
 * Performs a GET request and promises the body of the response, or the
 * full response object on error.
 * @function
 * @param {string} endpoint The endpoint to request
 * @param {object} data Query parameters as an object
 * @param {object} options Additional options passed to sendRequest()
 */
export const getJSON = (endpoint, query = {}, options = {}) => sendRequest({
    okOnly: true,
    method: 'GET',
    endpoint,
    query,
    ...options,
}).then(response => response.json());

/**
 * Performs a POST request and promises the body of the response, or the
 * full response object on error. Maintains an API similar to `$.post`.
 * @function
 * @param {string} endpoint The endpoint to request
 * @param {object} body The body parameters of the request
 * @param {object} [options] Additional options to TBApi.sendRequest
 * @returns {Promise} Resolves to response data or rejects an error
 */
export const post = (endpoint, body, options = {}) => sendRequest({
    okOnly: true,
    method: 'POST',
    endpoint,
    body,
    ...options,
}).then(response => response.json());

/**
 * Sends an authenticated POST request against the OAuth API.
 * @function
 * @param {string} endpoint The endpoint to request
 * @param {object} body Body parameters as an object
 * @param {object} [options] Additional options to TBApi.sendRequest
 */
export const apiOauthPOST = (endpoint, body, options = {}) => sendRequest({
    method: 'POST',
    oauth: true,
    endpoint,
    body,
    okOnly: true,
    ...options,
});

/**
 * Sends an authenticated GET request against the OAuth API.
 * @function
 * @param {string} endpoint The endpoint to request
 * @param {object} data Query parameters as an object
 */
export const apiOauthGET = (endpoint, query) => sendRequest({
    method: 'GET',
    oauth: true,
    endpoint,
    query,
    okOnly: true,
});

/**
 * Sends an authenticated DELETE request against the OAuth API.
 * @function
 * @param {string} endpoint The endpoint to request
 * @param {object} query Query parameters as an object
 * @returns {Promise}
 */
export const apiOauthDELETE = (endpoint, query) => sendRequest({
    method: 'DELETE',
    oauth: true,
    endpoint,
    query,
    okOnly: true,
});

/**
 * A promise that will fulfill with details about the current user, or reject if
 * user details can't be fetched. May return a cached details object if multiple
 * timeouts are encountered.
 * @type {Promise<object | undefined>} JSON response from `/api/me.json`
 */
const userDetailsPromise = (async function fetchUserDetails (tries = 3) {
    try {
        const data = await getJSON('/api/me.json');
        TBStorage.purifyObject(data);
        TBStorage.setCache('Utils', 'userDetails', data);
        return data;
    } catch (error) {
        // 504 Gateway Timeout errors can be retried
        if (error.response && error.response.status === 504 && tries > 1) {
            return fetchUserDetails(tries - 1);
        }

        // Throw all other errors without retrying
        throw error;
    }
})()
    // If getting details from API fails, fall back to the cached value (if any)
    .catch(() => TBStorage.getCache('Utils', 'userDetails'));

/**
 * Gets details about the current user.
 * @returns {Promise<object>}
 */
export const getUserDetails = () => userDetailsPromise;

/**
 * Gets the modhash of the currently signed-in user.
 * @returns {Promise<string>}
 */
export const getModhash = async () => {
    const userDetails = await getUserDetails();
    return userDetails.data.modhash;
};

/**
 * Gets the username of the currently signed-in user.
 * @returns {Promise<string>}
 */
export const getCurrentUser = async () => {
    const userDetails = await getUserDetails();
    return userDetails.data.name;
};

/**
 * Mod-distinguishes a post or comment.
 * @function
 * @param {string} id The fullname of the post or comment
 * @param {boolean} sticky If distinguishing a top-level comment, whether to
 * also sticky the comment
 * @returns {Promise}
 */
export const distinguishThing = async (id, sticky) => post('/api/distinguish/yes', {
    id,
    sticky,
    uh: await getModhash(),
});

/**
 * Removes a post or comment.
 * @function
 * @param {string} id Fullname of the post or comment
 * @param {boolean?} spam If true, removes as spam
 * @returns {Promise}
 */
export const removeThing = async (id, spam = false) => post('/api/remove', {
    uh: await getModhash(),
    id,
    spam,
});

/**
 * Locks a post or comment.
 * @param {string} id The fullname of the submission or comment
 * @returns {Promise} Resolves to response data or rejects with a jqXHR
 */
export const lock = async id => apiOauthPOST('/api/lock', {
    id,
    uh: await getModhash(),
});

/**
 * Posts a comment.
 * @function
 * @param {string} parent The fullname of the parent submission or comment
 * @param {string} text The text of the comment to post
 * @returns {Promise} Resolves to a response or rejects with an error or array of errors
 */
export const postComment = async (parent, text) => {
    try {
        const response = await post('/api/comment', {
            parent,
            uh: await getModhash(),
            text,
            api_type: 'json',
        });
        if (Object.prototype.hasOwnProperty.call(response.json, 'errors') && response.json.errors.length > 0) {
            logger.log(`Failed to post comment to on ${parent}`);
            logger.log(response.json.fails);
            throw response.json.errors;
        }
        logger.log(`Successfully posted comment on ${parent}`);
        return response;
    } catch (error) {
        logger.log(`Failed to post link to on ${parent}`);
        logger.log(error);
        throw error;
    }
};

/**
 * Fetches a page of mod notes for the given user in the given subreddit.
 * @param {string} subreddit The name of the subreddit
 * @param {*} user The name of a user
 * @param {*} before ID of a mod note to search before (for pagination)
 * @returns {Promise} Resolves to an array of note objects or rejects an error
 */
export const getModNotes = (subreddit, user, before) => apiOauthGET('/api/mod/notes', {
    subreddit,
    user,
    before,
    limit: 100,
}).then(response => response.json()).then(response => {
    TBStorage.purifyObject(response);
    return response.mod_notes;
});

/**
 * Fetches given number of mod notes of specified type for the given user in the given subreddit.
 * @param {string} subreddit The name of the subreddit
 * @param {*} user The name of a user
 * @returns {Promise} Resolves to an array of note objects or rejects an error
 */
export const getModNotesWithCounts = (subreddit, user) => apiOauthGET('/api/mod/notes', {
    subreddit,
    user,
    filter: 'NOTE',
    limit: 100,
}).then(response => response.json()).then(response => {
    TBStorage.purifyObject(response);
    var tally = {};
    response.mod_notes.forEach(note => {
      const label = note.user_note_data.label;
      if (tally[label]) {
        tally[label] += 1;
      }
      else {
        tally[label] = 1;
      }
    });
    return tally;
});

/**
 * For each given (user, subreddit) pair, fetches the most recent mod note for
 * that user in that subreddit.
 * @param {string[]} subreddits List of subreddit names
 * @param {string[]} users List of user names
 * @returns {Promise} Resolves to an array of note objects, where each
 * corresponds to the user and subreddit at the same index; if a given user has
 * no notes in the given subreddit, the corresponding item will be `null`
 */
export const getRecentModNotes = (subreddits, users) => apiOauthGET('/api/mod/notes/recent', {
    subreddits: subreddits.join(','),
    users: users.join(','),
}).then(response => response.json()).then(response => {
    TBStorage.purifyObject(response);
    return response.mod_notes;
});

/**
 * Creates a mod note on the given user in the given subreddit.
 * @param {object} data
 * @param {string} data.subreddit The name of the subreddit
 * @param {string} data.user The name of the user
 * @param {string} data.note The text of the note to add
 * @param {string} data.[label] One of Reddit's supported note labels
 * @param {string} data.[redditID] Fullname of an associated post or comment
 * @returns {Promise}
 */
export const createModNote = ({
    subreddit,
    user,
    note,
    label,
    redditID,
}) => apiOauthPOST('/api/mod/notes', {
    subreddit,
    user,
    note,
    label,
    reddit_id: redditID,
});

/**
 * Deletes a mod note on the given user in the given subreddit.
 * @param {object} data
 * @param {string} subreddit The name of the subreddit
 * @param {string} user The name of the user
 * @param {string} id The ID of the note
 * @returns {Promise}
 */
export const deleteModNote = ({subreddit, user, id}) => apiOauthDELETE('/api/mod/notes', {
    subreddit,
    user,
    note_id: id,
});
