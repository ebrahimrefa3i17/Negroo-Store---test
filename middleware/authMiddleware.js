// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("JWT_SECRET is not defined in environment variables! Auth middleware will not function.");
    process.exit(1);
}

const auth = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const xAuthToken = req.header('x-auth-token');

    let token;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (xAuthToken) {
        token = xAuthToken;
    }

    // **التعديل الأساسي هنا:**
    // إذا لم يكن هناك رمز، نمرر الطلب إلى المسار التالي.
    // المسارات التي تتطلب مصادقة صارمة يجب أن تتحقق من req.user صراحةً.
    if (!token) {
        // console.log('Auth Middleware (Permissive): No token found. Allowing request to proceed.'); // للتتبع
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            isAdmin: decoded.isAdmin,
            name: decoded.name // ✅ تأكد من وجود خاصية 'name' هنا
        };
        // console.log('Auth Middleware (Permissive): Token verified for user:', req.user.email, 'isAdmin:', req.user.isAdmin, 'URL:', req.originalUrl); // للتتبع
        next();
    } catch (err) {
        // إذا كان الرمز غير صالح، لا نرفض الطلب هنا.
        // بدلاً من ذلك، نترك req.user فارغًا (غير معرف) ونسمح للطلب بالمتابعة.
        console.warn('Auth Middleware (Permissive): Token is not valid or expired. Allowing request to proceed without user context.', err.message);
        return next();
    }
};

const adminAuth = (req, res, next) => {
    // console.log('AdminAuth Middleware: Initiated.'); // للتتبع
    // نستخدم middleware 'auth' العادي أولاً لمحاولة الحصول على معلومات المستخدم
    auth(req, res, (err) => {
        // إذا حدث خطأ برمجي (وليس خطأ مصادقة من middleware auth)
        if (err) {
            console.error('AdminAuth Middleware: Error from underlying auth middleware:', err);
            return res.status(500).json({ message: 'Internal server error during authentication check.' });
        }

        // إذا لم يتم تعبئة req.user (أي لا يوجد رمز أو الرمز غير صالح)
        if (!req.user) {
            // console.log('AdminAuth Middleware: User is not authenticated. Denying access.'); // للتتبع
            return res.status(401).json({ message: 'Authorization required for admin access.' });
        }

        // إذا كان المستخدم غير مسؤول
        if (!req.user.isAdmin === true) { // تأكد من أن isAdmin هو true
            // console.log('AdminAuth Middleware: User is NOT admin. Denying access.'); // للتتبع
            return res.status(403).json({ message: 'Access denied, administrator privileges required.' });
        }

        // console.log('AdminAuth Middleware: User is admin. Proceeding.'); // للتتبع
        next();
    });
};

module.exports = { auth, adminAuth };