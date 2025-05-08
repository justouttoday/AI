/**
 * Firebase Database Integration for Blog
 * This script connects the blog to Firebase Realtime Database
 */

class FirebaseDB {
    constructor() {
        this.initializeFirebase();
        this.auth = firebase.auth();
        this.db = firebase.database();
        this.storage = firebase.storage();
    }
    
    initializeFirebase() {
        // Your web app's Firebase configuration
        // Replace with your actual Firebase project config
        const firebaseConfig = {
            apiKey: "REPLACE_WITH_YOUR_API_KEY",
            authDomain: "your-blog-app.firebaseapp.com",
            databaseURL: "https://your-blog-app.firebaseio.com",
            projectId: "your-blog-app",
            storageBucket: "your-blog-app.appspot.com",
            messagingSenderId: "your-messaging-sender-id",
            appId: "your-app-id"
        };
        
        // Initialize Firebase if not already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
    }
    
    // Authentication methods
    async login(email, password) {
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            return userCredential.user;
        } catch (error) {
            console.error("Login error:", error);
            throw error;
        }
    }
    
    async logout() {
        try {
            await this.auth.signOut();
        } catch (error) {
            console.error("Logout error:", error);
            throw error;
        }
    }
    
    // Article methods
    async getArticles() {
        try {
            const snapshot = await this.db.ref('articles').once('value');
            const data = snapshot.val() || {};
            
            // Convert the object to an array
            return Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
        } catch (error) {
            console.error("Error getting articles:", error);
            throw error;
        }
    }
    
    async getArticleById(id) {
        try {
            const snapshot = await this.db.ref(`articles/${id}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error("Error getting article:", error);
            throw error;
        }
    }
    
    async saveArticle(article) {
        try {
            if (article.id) {
                // Update existing article
                const { id, ...articleData } = article;
                await this.db.ref(`articles/${id}`).update(articleData);
                return id;
            } else {
                // Create new article
                const newArticleRef = this.db.ref('articles').push();
                await newArticleRef.set(article);
                return newArticleRef.key;
            }
        } catch (error) {
            console.error("Error saving article:", error);
            throw error;
        }
    }
    
    async deleteArticle(id) {
        try {
            await this.db.ref(`articles/${id}`).remove();
        } catch (error) {
            console.error("Error deleting article:", error);
            throw error;
        }
    }
    
    // Comment methods
    async getComments(articleId) {
        try {
            const snapshot = await this.db.ref(`comments/${articleId}`).once('value');
            const data = snapshot.val() || {};
            
            // Convert the object to an array
            return Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
        } catch (error) {
            console.error("Error getting comments:", error);
            throw error;
        }
    }
    
    async addComment(articleId, comment) {
        try {
            const newCommentRef = this.db.ref(`comments/${articleId}`).push();
            await newCommentRef.set(comment);
            return newCommentRef.key;
        } catch (error) {
            console.error("Error adding comment:", error);
            throw error;
        }
    }
    
    async deleteComment(articleId, commentId) {
        try {
            await this.db.ref(`comments/${articleId}/${commentId}`).remove();
        } catch (error) {
            console.error("Error deleting comment:", error);
            throw error;
        }
    }
    
    // Settings methods
    async getSettings() {
        try {
            const snapshot = await this.db.ref('settings').once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error("Error getting settings:", error);
            throw error;
        }
    }
    
    async saveSettings(settings) {
        try {
            await this.db.ref('settings').set(settings);
        } catch (error) {
            console.error("Error saving settings:", error);
            throw error;
        }
    }
    
    // Image upload method
    async uploadImage(file) {
        try {
            const timestamp = new Date().getTime();
            const fileName = `${timestamp}_${file.name}`;
            const storageRef = this.storage.ref(`images/${fileName}`);
            
            // Upload file
            const snapshot = await storageRef.put(file);
            
            // Get download URL
            const downloadURL = await snapshot.ref.getDownloadURL();
            return downloadURL;
        } catch (error) {
            console.error("Error uploading image:", error);
            throw error;
        }
    }
}

// Initialize the database when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.db = new FirebaseDB();
});
