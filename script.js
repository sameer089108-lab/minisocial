
const SUPABASE_URL = "https://ovmtfaypbmdokncqmfts.supabase.co";
const SUPABASE_KEY = "sb_publishable_9D5iFxEKHNY3RDMeA3dk5w_OBbAtxPP";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const usernameInput = document.getElementById("username");
const saveNameBtn = document.getElementById("saveName");
const welcomeMessage = document.getElementById("welcomeMessage");
const postText = document.getElementById("postText");
const publishBtn = document.getElementById("publishBtn");
const postsContainer = document.getElementById("posts");
const charCount = document.getElementById("charCount");

let username = localStorage.getItem("miniSocialName") || "";
let posts = [];

usernameInput.value = username;

function updateWelcome() {
    welcomeMessage.textContent = username
        ? `Hello, ${username}! Welcome to MiniSocial.`
        : "Choose a username to get started.";
}

saveNameBtn.addEventListener("click", () => {
    const name = usernameInput.value.trim();

    if (!name) {
        alert("Please enter a username!");
        return;
    }

    username = name.slice(0, 30);
    localStorage.setItem("miniSocialName", username);
    usernameInput.value = username;
    updateWelcome();
});

postText.addEventListener("input", () => {
    charCount.textContent = `${postText.value.length}/500`;
});

publishBtn.addEventListener("click", async () => {
    if (!username) {
        alert("Please save your username first!");
        return;
    }

    const content = postText.value.trim();

    if (!content || content.length > 500) {
        alert("Enter a post between 1 and 500 characters.");
        return;
    }

    publishBtn.disabled = true;

    try {
        const { error } = await db.from("posts").insert({
            author: username,
            content: content
        });

        if (error) throw error;

        postText.value = "";
        charCount.textContent = "0/500";
        await loadPosts();
    } catch (error) {
        console.error("Publish error:", error);
        alert("Could not publish. Check the Console for the error.");
    } finally {
        publishBtn.disabled = false;
    }
});

async function loadPosts() {
    const { data, error } = await db
        .from("posts")
        .select("id, author, content, likes, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Load posts error:", error);
        return;
    }

    posts = data;
    renderPosts();
}

function renderPosts() {
    postsContainer.replaceChildren();

    if (posts.length === 0) {
        const message = document.createElement("p");
        message.className = "empty-message";
        message.textContent = "No posts yet. Be the first!";
        postsContainer.appendChild(message);
        return;
    }

    posts.forEach(post => {
        const article = document.createElement("article");
        article.className = "post";

        const header = document.createElement("div");
        header.className = "post-header";

        const author = document.createElement("strong");
        author.textContent = post.author;

        const time = document.createElement("span");
        time.className = "post-time";
        time.textContent = new Date(post.created_at).toLocaleString();

        header.append(author, time);

        const content = document.createElement("p");
        content.className = "post-content";
        content.textContent = post.content;

        const buttons = document.createElement("div");
        buttons.className = "post-buttons";

        const likeBtn = document.createElement("button");
        likeBtn.className = "like-btn";
        likeBtn.textContent = `♥ Like (${post.likes})`;

        likeBtn.addEventListener("click", async () => {
            likeBtn.disabled = true;

            const { error } = await db
                .from("posts")
                .update({ likes: post.likes + 1 })
                .eq("id", post.id)
                .eq("likes", post.likes);

            if (error) {
                console.error("Like error:", error);
                alert("Could not update likes.");
            }

            await loadPosts();
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "Delete";

        deleteBtn.addEventListener("click", () => {
            alert("Delete is not enabled yet. We'll add it safely next.");
        });

        buttons.append(likeBtn, deleteBtn);
        article.append(header, content, buttons);
        postsContainer.appendChild(article);
    });
}

updateWelcome();
loadPosts();
setInterval(loadPosts, 5000);
