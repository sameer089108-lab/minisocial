// MiniSocial: Supabase account authentication and shared posts.
// Use your project's URL and publishable key here. Never put a service_role/secret key in this file.
const SUPABASE_URL = "https://ovmtfaypbmdokncqmfts.supabase.co";
const SUPABASE_KEY = "sb_publishable_9D5iFxEKHNY3RDMeA3dk5w_OBbAtxPP";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const authUsername = document.getElementById("authUsername");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMessage = document.getElementById("authMessage");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const welcomeMessage = document.getElementById("welcomeMessage");
const postText = document.getElementById("postText");
const publishBtn = document.getElementById("publishBtn");
const postsContainer = document.getElementById("posts");
const charCount = document.getElementById("charCount");

let currentUser = null;
let posts = [];
let loadingPosts = false;

function showMessage(message) {
    authMessage.textContent = message;
}

function currentUsername() {
    const metadataName = currentUser?.user_metadata?.username;
    return (metadataName || currentUser?.email?.split("@")[0] || "MiniSocial user").slice(0, 30);
}

function updateAuthUI() {
    const loggedIn = Boolean(currentUser);
    authUsername.disabled = loggedIn;
    authEmail.disabled = loggedIn;
    authPassword.disabled = loggedIn;
    signupBtn.hidden = loggedIn;
    loginBtn.hidden = loggedIn;
    logoutBtn.hidden = !loggedIn;
    postText.disabled = !loggedIn;
    publishBtn.disabled = !loggedIn;
    welcomeMessage.textContent = loggedIn
        ? `Hello, ${currentUsername()}! You are logged in.`
        : "Log in to use MiniSocial.";
}

signupBtn.addEventListener("click", async () => {
    const username = authUsername.value.trim().slice(0, 30);
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!username || !email || !password) {
        showMessage("Enter a username, email, and password.");
        return;
    }
    if (password.length < 6) {
        showMessage("Use a password with at least 6 characters.");
        return;
    }

    signupBtn.disabled = true;
    try {
        const { data, error } = await db.auth.signUp({
            email,
            password,
            options: {
                data: { username },
                emailRedirectTo: window.location.origin + window.location.pathname
            }
        });
        if (error) throw error;

        if (data.session) {
            currentUser = data.user;
            updateAuthUI();
            showMessage("Account created and you are logged in.");
        } else {
            showMessage("Account created! Check your email and click the verification link, then return here and log in.");
        }
    } catch (error) {
        console.error("Sign-up error:", error);
        showMessage(error.message || "Could not sign up. Please try again.");
    } finally {
        signupBtn.disabled = Boolean(currentUser);
    }
});

loginBtn.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) {
        showMessage("Enter your email and password.");
        return;
    }

    loginBtn.disabled = true;
    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        updateAuthUI();
        showMessage("You are logged in.");
        await loadPosts();
    } catch (error) {
        console.error("Login error:", error);
        showMessage(error.message || "Could not log in. Verify your email and try again.");
    } finally {
        loginBtn.disabled = Boolean(currentUser);
    }
});

logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    try {
        const { error } = await db.auth.signOut();
        if (error) throw error;
        currentUser = null;
        updateAuthUI();
        showMessage("You have logged out.");
    } catch (error) {
        console.error("Logout error:", error);
        showMessage("Could not log out. Please try again.");
    } finally {
        logoutBtn.disabled = false;
    }
});

postText.addEventListener("input", () => {
    charCount.textContent = `${postText.value.length}/500`;
});

publishBtn.addEventListener("click", async () => {
    if (!currentUser) {
        showMessage("Please log in before publishing.");
        return;
    }

    const content = postText.value.trim();
    if (!content || content.length > 500) {
        showMessage("Enter a post between 1 and 500 characters.");
        return;
    }

    publishBtn.disabled = true;
    try {
        const { error } = await db.from("posts").insert({
            author: currentUsername(),
            content,
            user_id: currentUser.id
        });
        if (error) throw error;
        postText.value = "";
        charCount.textContent = "0/500";
        showMessage("Your post was published.");
        await loadPosts();
    } catch (error) {
        console.error("Publish error:", error);
        showMessage("Could not publish. Check the database setup and browser Console.");
    } finally {
        publishBtn.disabled = !currentUser;
    }
});

async function loadPosts() {
    if (loadingPosts) return;
    loadingPosts = true;
    try {
        const { data, error } = await db
            .from("posts")
            .select("id, author, content, likes, created_at, user_id")
            .order("created_at", { ascending: false });

        if (error) throw error;
        posts = data || [];
        renderPosts();
    } catch (error) {
        console.error("Load posts error:", error);
        postsContainer.textContent = "Could not load posts. Check the browser Console and Supabase policies.";
    } finally {
        loadingPosts = false;
    }
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
            try {
                const { error } = await db.from("posts")
                    .update({ likes: post.likes + 1 })
                    .eq("id", post.id)
                    .eq("likes", post.likes);
                if (error) throw error;
                await loadPosts();
            } catch (error) {
                console.error("Like error:", error);
                showMessage("Could not update likes. Check your Supabase update policy.");
                likeBtn.disabled = false;
            }
        });

        buttons.appendChild(likeBtn);
        article.append(header, content, buttons);
        postsContainer.appendChild(article);
    });
}

async function initialise() {
    const { data, error } = await db.auth.getSession();
    if (error) console.error("Session error:", error);
    currentUser = data?.session?.user || null;
    updateAuthUI();

    db.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        updateAuthUI();
    });

    await loadPosts();
    setInterval(loadPosts, 10000);
}

initialise();
