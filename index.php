<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Minimarket</title>
    <link rel="stylesheet" href="./css/styleslogin.css">
</head>
<body>
    <div class="login-container">
        <h1>Login</h1>
        <form id="login-form">
            <input type="text" id="username" placeholder="Username" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
        <p id="login-error" class="hidden">Invalid username or password</p>
    </div>
    <script src="./js/login.js"></script>
</body>
</html>
