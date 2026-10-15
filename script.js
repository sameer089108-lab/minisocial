// MiniSocial: Supabase authentication, shared posts, and editable profiles.
// Use the project's publishable key only. Never put a service_role/secret key in browser code.
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

const myProfileSection = document.getElementById("myProfileSection");
const profileUsername = document.getElementById("profileUsername");
const profileBio = document.getElementById("profileBio");
const profileAvatarUrl = document.getElementById("profileAvatarUrl");
const profilePhotoFile = document.getElementById("profilePhotoFile");
const uploadPhotoBtn = document.getElementById("uploadPhotoBtn");
const uploadPhotoMessage = document.getElementById("uploadPhotoMessage");
const profileAvatarPreview = document.getElementById("profileAvatarPreview");
const profilePreviewName = document.getElementById("profilePreviewName");
const profilePreviewBio = document.getElementById("profilePreviewBio");
const bioCount = document.getElementById("bioCount");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileMessage = document.getElementById("profileMessage");

const DEFAULT_AVATAR = "https://placehold.co/96x96?text=Me";
let currentUser = null;
let currentProfile = null;
let posts = [];
let loadingPosts = false;
let profileRequestId = 0;

function showMessage(message) {
    authMessage.textContent = message;
}

function showProfileMessage(message, isError = false) {
    profileMessage.textContent = message;
    profileMessage.classList.toggle("error-message", isError);
}

function currentUsername() {
    const profileName = currentProfile?.username;
    const metadataName = currentUser?.user_metadata?.username;
    return (profileName || metadataName || currentUser?.email?.split("@")[0] || "MiniSocial user").slice(0, 30);
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
    myProfileSection.hidden = !loggedIn;
    welcomeMessage.textContent = loggedIn
        ? `Hello, ${currentUsername()}! You are logged in.`
        : "Log in to use MiniSocial.";
}

function updateProfilePreview() {
    const name = profileUsername.value.trim() || "Your username";
    const bio = profileBio.value.trim() || "Your bio will appear here.";
    const url = profileAvatarUrl.value.trim();
    profilePreviewName.textContent = name;
    profilePreviewBio.textContent = bio;
    bioCount.textContent = `${profileBio.value.length}/160`;

    // Only allow HTTP(S) image URLs; avoid javascript:, data:, and other schemes.
    try {
        const parsed = url ? new URL(url) : null;
        profileAvatarPreview.src = parsed && ["https:", "http:"].includes(parsed.protocol)
            ? parsed.href
            : DEFAULT_AVATAR;
    } catch {
        profileAvatarPreview.src = DEFAULT_AVATAR;
    }
}

[profileUsername, profileBio, profileAvatarUrl].forEach(input => {
    input.addEventListener("input", updateProfilePreview);
});

profileAvatarPreview.addEventListener("error", () => {
    profileAvatarPreview.src = DEFAULT_AVATAR;
});

async function loadProfile() {
    if (!currentUser) {
        currentProfile = null;
        updateAuthUI();
        return;
    }

    const requestId = ++profileRequestId;
    profileMessage.textContent = "";
    try {
        const { data, error } = await db
            .from("profiles")
            .select("id, username, bio, avatar_url, updated_at")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;
        if (requestId !== profileRequestId || !currentUser) return;

        if (data) {
            currentProfile = data;
        } else {
            // Seed a profile for existing users from their signup username/email.
            const suggestedName = (
                currentUser.user_metadata?.username ||
                currentUser.email?.split("@")[0] ||
                "user"
            ).slice(0, 30);

            currentProfile = {
                id: currentUser.id,
                username: suggestedName,
                bio: "",
                avatar_url: ""
            };

            const { error: insertError } = await db.from("profiles").insert({
                id: currentUser.id,
                username: suggestedName,
                bio: "",
                avatar_url: null
            });

            if (insertError) {
                // A username collision is recoverable: the user can choose another below.
                console.warn("Could not create starter profile:", insertError.message);
            }
        }

        profileUsername.value = currentProfile.username || "";
        profileBio.value = currentProfile.bio || "";
        profileAvatarUrl.value = currentProfile.avatar_url || "";
        updateProfilePreview();
        updateAuthUI();
    } catch (error) {
        console.error("Load profile error:", error);
        showProfileMessage("Couldn't load your profile. Check the profiles table and its RLS policies.", true);
    }
}


function showUploadMessage(message, isError = false) {
    uploadPhotoMessage.textContent = message;
    uploadPhotoMessage.classList.toggle("error-message", isError);
}

uploadPhotoBtn.addEventListener("click", async () => {
    if (!currentUser) {
        showUploadMessage("Please log in first.", true);
        return;
    }
    const file = profilePhotoFile.files && profilePhotoFile.files[0];
    if (!file) {
        showUploadMessage("Choose an image first.", true);
        return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
        showUploadMessage("Choose a JPG, PNG, WEBP, or GIF image.", true);
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showUploadMessage("Image must be 5 MB or smaller.", true);
        return;
    }

    uploadPhotoBtn.disabled = true;
    showUploadMessage("Uploading photo…");
    try {
        const extensionByType = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif"
        };
        const extension = extensionByType[file.type];
        const path = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await db.storage
            .from("avatars")
            .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;

        const { data: publicData } = db.storage.from("avatars").getPublicUrl(path);
        const publicUrl = publicData.publicUrl;
        const { data, error } = await db.from("profiles").upsert({
            id: currentUser.id,
            username: profileUsername.value.trim() || currentUsername(),
            bio: profileBio.value.trim(),
            avatar_url: publicUrl,
            updated_at: new Date().toISOString()
        }, { onConflict: "id" }).select("id, username, bio, avatar_url, updated_at").single();
        if (error) throw error;

        currentProfile = data;
        profileAvatarUrl.value = publicUrl;
        updateProfilePreview();
        updateAuthUI();
        showUploadMessage("Photo uploaded and profile picture saved!");
    } catch (error) {
        console.error("Avatar upload error:", error);
        showUploadMessage(error.message || "Upload failed. Check the Storage policies and try again.", true);
    } finally {
        uploadPhotoBtn.disabled = !currentUser;
    }
});

saveProfileBtn.addEventListener("click", async () => {
    if (!currentUser) {
        showProfileMessage("Please log in first.", true);
        return;
    }

    const username = profileUsername.value.trim();
    const bio = profileBio.value.trim();
    const avatarUrl = profileAvatarUrl.value.trim();

    if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) {
        showProfileMessage("Username must be 3–30 characters: letters, numbers, dots, underscores or hyphens.", true);
        return;
    }
    if (bio.length > 160) {
        showProfileMessage("Bio must be 160 characters or fewer.", true);
        return;
    }

    let safeAvatarUrl = null;
    if (avatarUrl) {
        try {
            const parsed = new URL(avatarUrl);
            if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Invalid URL scheme");
            safeAvatarUrl = parsed.href;
        } catch {
            showProfileMessage("Enter a valid public image URL beginning with https:// or http://.", true);
            return;
        }
    }

    saveProfileBtn.disabled = true;
    showProfileMessage("Saving profile…");
    try {
        const { data, error } = await db.from("profiles").upsert({
            id: currentUser.id,
            username,
            bio,
            avatar_url: safeAvatarUrl,
            updated_at: new Date().toISOString()
        }, { onConflict: "id" }).select("id, username, bio, avatar_url, updated_at").single();

        if (error) throw error;

        currentProfile = data;

        // Keep signup metadata in step with the profile name for fallback compatibility.
        const { error: metadataError } = await db.auth.updateUser({
            data: { username }
        });
        if (metadataError) console.warn("Profile saved, but auth metadata wasn't updated:", metadataError.message);

        updateProfilePreview();
        updateAuthUI();
        showProfileMessage("Profile saved! It will be available on your other devices after refresh.");
        await loadPosts();
    } catch (error) {
        console.error("Save profile error:", error);
        if (error.code === "23505" || /duplicate key|unique/i.test(error.message || "")) {
            showProfileMessage("That username is already taken. Please choose another.", true);
        } else {
            showProfileMessage(error.message || "Could not save profile. Check the profiles table and RLS policies.", true);
        }
    } finally {
        saveProfileBtn.disabled = !currentUser;
    }
});

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
            await loadProfile();
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
        await loadProfile();
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
        currentProfile = null;
        profileRequestId++;
        updateAuthUI();
        profileUsername.value = "";
        profileBio.value = "";
        profileAvatarUrl.value = "";
        profilePhotoFile.value = "";
        showUploadMessage("");
        updateProfilePreview();
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
        const nextUser = session?.user || null;
        const userChanged = nextUser?.id !== currentUser?.id;
        currentUser = nextUser;
        updateAuthUI();

        // Defer database work out of the auth callback to avoid blocking auth events.
        if (userChanged && currentUser) {
            setTimeout(() => {
                loadProfile();
                loadPosts();
            }, 0);
        } else if (!currentUser) {
            currentProfile = null;
            profileRequestId++;
        }
    });

    if (currentUser) await loadProfile();
    updateAuthUI();
    updateProfilePreview();
    await loadPosts();
    setInterval(loadPosts, 10000);
}

initialise();
