
const usernameInput = document.getElementById("username");
const saveNameBtn = document.getElementById("saveName");
const welcomeMessage = document.getElementById("welcomeMessage");

const postText = document.getElementById("postText");
const publishBtn = document.getElementById("publishBtn");
const postsContainer = document.getElementById("posts");
const charCount = document.getElementById("charCount");

let username = localStorage.getItem("miniSocialName") || "";
let posts = JSON.parse(localStorage.getItem("miniSocialPosts") || "[]");

usernameInput.value = username;

function updateWelcome() {
    welcomeMessage.textContent = username
        ? `Hello, ${username}! Welcome to MiniSocial.`
        : "Choose a username to get started.";
}

function savePosts() {
    localStorage.setItem("miniSocialPosts", JSON.stringify(posts));
}

function saveName() {
    const name = usernameInput.value.trim();

    if (!name) {
        alert("Please enter a username!");
        return;
    }

    username = name.slice(0, 30);
    localStorage.setItem("miniSocialName", username);
    usernameInput.value = username;
    updateWelcome();
    renderPosts();
}

saveNameBtn.addEventListener("click", saveName);

postText.addEventListener("input", () => {
    charCount.textContent = `${postText.value.length}/500`;
});

publishBtn.addEventListener("click", () => {
    if (!username) {
        alert("Please save your username first!");
        usernameInput.focus();
        return;
    }

    const content = postText.value.trim();

    if (!content) {
        alert("Please write something before publishing!");
        return;
    }

    posts.unshift({
        id: Date.now() + Math.random(),
        author: username,
        content: content,
        likes: 0,
        time: new Date().toLocaleString()
    });

    savePosts();
    renderPosts();

    postText.value = "";
    charCount.textContent = "0/500";
});

function renderPosts() {
    postsContainer.replaceChildren();

    if (posts.length === 0) {
        const message = document.createElement("p");
        message.className = "empty-message";
        message.textContent = "No posts yet. Be the first!";
        postsContainer.appendChild(message);
        return;
    }

    posts.forEach((post) => {
        const article = document.createElement("article");
        article.className = "post";

        const header = document.createElement("div");
        header.className = "post-header";

        const author = document.createElement("strong");
        author.textContent = post.author;

        const time = document.createElement("span");
        time.className = "post-time";
        time.textContent = post.time;

        header.append(author, time);

        const content = document.createElement("p");
        content.className = "post-content";
        content.textContent = post.content;

        const buttons = document.createElement("div");
        buttons.className = "post-buttons";

        const likeBtn = document.createElement("button");
        likeBtn.className = "like-btn";
        likeBtn.textContent = `♥ Like (${post.likes})`;

        likeBtn.addEventListener("click", () => {
            post.likes++;
            savePosts();
            renderPosts();
        });

        buttons.appendChild(likeBtn);

        if (post.author === username) {
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "delete-btn";
            deleteBtn.textContent = "Delete";

            deleteBtn.addEventListener("click", () => {
                posts = posts.filter(item => item.id !== post.id);
                savePosts();
                renderPosts();
            });

            buttons.appendChild(deleteBtn);
        }

        article.append(header, content, buttons);
        postsContainer.appendChild(article);
    });
}

updateWelcome();
renderPosts();
