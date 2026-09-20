export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const options: RequestInit = { ...init };
  options.credentials = options.credentials || 'include';

  try {
    const response = await fetch(input, options);

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        const CE = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent;
        window.dispatchEvent(
          new CE('auth:unauthorized', {
            detail: { message: 'Session expired. Please sign in again.' },
          })
        );
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
};


