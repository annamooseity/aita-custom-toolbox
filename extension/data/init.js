import * as TBApi from './api.js';
var author_links = Array.from(document.getElementsByClassName('author'));

author_links.forEach((link) => {
    console.log(link.textContent);
    const thing = document.createTextNode("SUP MOTHERFUCKERS");
    const container = document.createElement("div");
    container.appendChild(thing);
    link.parentNode.appendChild(container);
    TBApi.getModNotes(subreddit, author)
});

