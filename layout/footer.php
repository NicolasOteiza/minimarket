<script src="./js/scripts.js"></script>
<script src="./js/functions.js"></script>
<script src="./js/logout.js"></script>
<script src="./js/popup.js"></script>
<script>
    // --- Menú colapsable ---
    const menuBtn = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('main-menu');

    menuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('collapsed');
    });
</script>

</body>

</html>