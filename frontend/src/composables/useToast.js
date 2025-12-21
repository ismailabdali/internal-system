import { ref } from 'vue';

const toasts = ref([]);
let toastIdCounter = 0;

export function useToast() {
  const showToast = (message, type = 'success', duration = 5000) => {
    const id = toastIdCounter++;
    const toast = {
      id,
      message,
      type, // 'success', 'error', 'info', 'warning'
      duration
    };
    toasts.value.push(toast);
    
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  return {
    toasts,
    showToast,
    removeToast
  };
}

