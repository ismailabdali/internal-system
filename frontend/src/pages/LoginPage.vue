<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-brand">
        <div class="brand-logo">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="var(--shc-deep-green)"/>
            <path d="M20 40C8.9543 40 0 31.0457 0 20C0 8.9543 8.9543 0 20 0" fill="var(--shc-magenta)" style="mix-blend-mode: overlay; opacity: 0.6"/>
            <circle cx="20" cy="20" r="12" stroke="var(--shc-gold)" stroke-width="1.5"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1>Sultan Haitham City</h1>
          <span class="brand-subtitle">Internal Services Portal</span>
        </div>
      </div>

      <div class="login-form-section">
        <h2>Welcome Back</h2>
        <p class="login-subtitle">Sign in to access the portal</p>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="input-group">
            <label>Email Address <span class="required">*</span></label>
            <input 
              v-model="loginForm.email" 
              type="email" 
              placeholder="your.email@housing.gov.om"
              required
              autocomplete="email"
            />
          </div>
          <div class="input-group">
            <label>Password <span class="required">*</span></label>
            <input 
              v-model="loginForm.password" 
              type="password" 
              placeholder="Enter your password"
              required
              autocomplete="current-password"
            />
          </div>
          <div v-if="loginError" class="error-message login-error">
            {{ loginError }}
          </div>
          <button type="submit" class="btn-primary" :disabled="isLoggingIn" style="width: 100%; margin-top: 1.5rem;">
            <span v-if="isLoggingIn" class="spinner-small"></span>
            <span>{{ isLoggingIn ? 'Signing in...' : 'Sign In' }}</span>
          </button>
        </form>

        <div class="login-hint">
          <p><strong>Demo credentials (password: password123):</strong></p>
          <ul>
            <li>admin@housing.gov.om (Super Admin)</li>
            <li>it@housing.gov.om (IT Admin)</li>
            <li>ismail@housing.gov.om (Employee)</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';

const apiBase = 'http://localhost:4000/api';
const { isLoggedIn, currentUser, authToken, clearAuth } = useAuth();
const { showToast } = useToast();

const emit = defineEmits(['login-success']);

const loginForm = ref({
  email: '',
  password: ''
});
const loginError = ref('');
const isLoggingIn = ref(false);

const handleLogin = async () => {
  loginError.value = '';
  isLoggingIn.value = true;
  
  try {
    // Validate form before sending
    if (!loginForm.value.email || !loginForm.value.email.trim()) {
      loginError.value = 'Email is required';
      isLoggingIn.value = false;
      return;
    }
    if (!loginForm.value.password || !loginForm.value.password.trim()) {
      loginError.value = 'Password is required';
      isLoggingIn.value = false;
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginForm.value.email.trim(),
          password: loginForm.value.password
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      let data;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch (parseErr) {
          console.error('[LOGIN] JSON parse error:', parseErr);
          throw new Error('Invalid response format from server.');
        }
      } else {
        const text = await res.text();
        console.error('[LOGIN] Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned invalid response format.');
      }
      
      if (!res.ok) {
        throw new Error(data.error || `Login failed (${res.status})`);
      }
      
      if (!data || !data.token || !data.user) {
        throw new Error('Invalid response from server. Missing token or user data.');
      }
      
      // Store token and user info
      authToken.value = data.token;
      currentUser.value = data.user;
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      
      // Clear form
      loginForm.value.email = '';
      loginForm.value.password = '';
      loginError.value = '';
      
      isLoggedIn.value = true;
      
      // Emit success event
      emit('login-success', data.user);
      
      showToast('Login successful!', 'success');
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (e) {
    if (e.name === 'AbortError' || e.message.includes('aborted')) {
      loginError.value = 'Login request timed out. Please check your connection and try again.';
    } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('ERR_')) {
      loginError.value = 'Cannot connect to server. Please ensure the backend server is running on port 4000.';
    } else {
      loginError.value = e.message || 'Login failed. Please check your credentials and try again.';
    }
    isLoggedIn.value = false;
  } finally {
    isLoggingIn.value = false;
  }
};
</script>

