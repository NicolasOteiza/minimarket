document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
   
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            const data = await response.json();
            // Guardar token o sesión
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', username); // Opcional: guardar el nombre de usuario
            window.location.href = 'home.php'; // Redirigir al sistema principal
        } else {
            document.getElementById('login-error').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error during login:', error);
        document.getElementById('login-error').classList.remove('hidden');
    }
});
