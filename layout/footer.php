</main>


    <script>
        const token = localStorage.getItem('token');
        if (!token) {
            // Si no hay token, redirige al login
            window.location.href = 'index.php';
        } else {
            console.log('Usuario autenticado:', localStorage.getItem('username'));
        }
    </script>
    <script>
        document.getElementById('logout').addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('username'); // Opcional
            window.location.href = 'index.php';
        });
    </script>
</body>

</html>