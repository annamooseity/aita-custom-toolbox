var author_links = Array.from(document.getElementsByClassName('author'));

author_links.forEach((link) => {
    console.log("hello!");
    const thing = document.createTextNode("SUP MOTHERFUCKERS");
    const container = document.createElement("div");
    container.appendChild(thing);
    link.parentNode.appendChild(container);
});

