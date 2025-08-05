// Negroo up/services/shippingService.js
const axios = require('axios'); // تأكد من تثبيت axios: npm install axios

const SHIPPING_COMPANY_API_URL = process.env.SHIPPING_COMPANY_API_URL || 'https://api.shippingcompany.com';
const SHIPPING_COMPANY_API_KEY = process.env.SHIPPING_COMPANY_API_KEY || 'your_api_key_here'; // استخدم متغيرات البيئة

async function createShippingOrder(orderData) {
    try {
        // تحويل بيانات الطلب إلى التنسيق الذي تتوقعه شركة الشحن
        const payload = {
            api_key: SHIPPING_COMPANY_API_KEY,
            // Shipping company specific fields
            customer_name: orderData.shippingAddress.fullName,
            customer_phone: orderData.shippingAddress.phone,
            customer_address: `${orderData.shippingAddress.addressLine1}, ${orderData.shippingAddress.city}, ${orderData.shippingAddress.governorate}, ${orderData.shippingAddress.country}`, // ✅ UPDATED: Added governorate
            order_id: orderData._id.toString(), // رقم الطلب من قاعدة بياناتك (تأكد أن يكون string)
            total_amount: orderData.totalAmount,
            shipping_cost: orderData.shippingAddress.shippingCost, // ✅ NEW: Shipping cost
            items: orderData.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                // أي تفاصيل أخرى للمنتج تحتاجها شركة الشحن (مثل الوزن، الأبعاد)
            })),
            // Other required fields by the shipping company API
            // e.g., service_type, payment_method_at_delivery (if COD), etc.
        };

        // هذا مجرد كود تجريبي. ستحتاج إلى استبدال هذا بمنطق الاتصال بـ API شركة الشحن الفعلية.
        console.log('--- Mock Shipping Service: Attempting to create shipment ---');
        console.log('Payload sent to mock shipping company:', payload);

        // هنا ستكون مكالمة الـ API الفعلية لشركة الشحن، مثلاً:
        // const response = await axios.post(`${SHIPPING_COMPANY_API_URL}/create-shipment`, payload, {
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': `Bearer ${SHIPPING_COMPANY_API_KEY}`
        //     }
        // });

        // للمحاكاة (Mocking)، سنفترض نجاح العملية ونعيد بيانات تجريبية
        const mockResponse = {
            data: {
                success: true,
                trackingId: `TRACK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                shippingCompanyOrderId: `COID-${Date.now()}`
            }
        };

        if (mockResponse.data && mockResponse.data.success) {
            console.log('Mock Shipping Service: Shipping order created successfully. Tracking ID:', mockResponse.data.trackingId);
            return {
                success: true,
                trackingId: mockResponse.data.trackingId,
                shippingCompanyOrderId: mockResponse.data.shippingCompanyOrderId
            };
        } else {
            console.error('Mock Shipping Service: Failed to create shipping order:', mockResponse.data);
            return { success: false, message: mockResponse.data.message || 'Unknown error from mock shipping company' };
        }
    } catch (error) {
        console.error('Error integrating with shipping company API:', error.message);
        // قد تحتاج هنا إلى إضافة منطق لإعادة المحاولة أو تسجيل الخطأ
        return { success: false, message: error.message };
    }
}

module.exports = {
    createShippingOrder
};