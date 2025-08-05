const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: { // نوع الإشعار (مثال: 'order_update', 'promotion', 'system')
        type: String,
        enum: ['order_update', 'promotion', 'system', 'new_message', 'new_product', 'low_stock_alert'], // ✅ تم إضافة 'low_stock_alert' هنا
        default: 'system'
    },
    link: { // رابط يمكن للمستخدم الانتقال إليه عند النقر على الإشعار
        type: String,
        trim: true
    },
    read: { // هل تم قراءة الإشعار
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;