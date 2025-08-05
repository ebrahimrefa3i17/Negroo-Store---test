# main.py

# --- الجزء 1: الاستيرادات وتهيئة التطبيق ---
# استيراد المكتبات اللازمة
from fastapi import FastAPI, UploadFile, File, HTTPException # لإطار عمل الويب
from pydantic import BaseModel # لتعريف هياكل بيانات الطلبات
import uvicorn # لخادم الويب ASGI
import numpy as np # للعمليات العددية والمصفوفات
from PIL import Image # لفتح ومعالجة الصور
import io # للتعامل مع تدفقات البايتات
import requests # لإنشاء طلبات HTTP لجلب الصور من URLs
import os # للتعامل مع متغيرات البيئة
from sklearn.metrics.pairwise import cosine_similarity # لحساب تشابه المتجهات (للاستخدام الاحتياطي أو إذا لم يتوفر Vector Search)
from pymongo import MongoClient # للاتصال بقاعدة بيانات MongoDB
from dotenv import load_dotenv, find_dotenv # لتحميل متغيرات البيئة من .env
import inspect # لمعرفة مسار الملف (مستخدم لـ debugging)

# ✅ الأهم: تأكد أن هذا السطر موجود تماماً كما هو
from transformers import CLIPProcessor, CLIPModel, TFCLIPModel # لاستخدام نموذج CLIP


# 1. تحميل متغيرات البيئة (مع تحسينات التتبع)
dotenv_path = find_dotenv()
if not dotenv_path:
    print("WARNING: .env file not found by find_dotenv(). Please ensure it's in the project root.")
else:
    load_dotenv(dotenv_path=dotenv_path) # تحميل من المسار الذي تم العثور عليه
    print(f"DEBUG: .env file found and loaded from: {dotenv_path}")

print(f"DEBUG: Current working directory for Python service: {os.getcwd()}")
print(f"DEBUG: MONGO_URI from .env: {os.getenv('MONGO_URI')}")
print(f"DEBUG: DB_NAME from .env: {os.getenv('DB_NAME')}")
print(f"DEBUG: COLLECTION_NAME from .env: {os.getenv('COLLECTION_NAME')}")
print(f"DEBUG: PYTHON_ML_PORT from .env: {os.getenv('PYTHON_ML_PORT')}")


# --- 2. تهيئة تطبيق FastAPI ---
app = FastAPI()

# --- 3. تهيئة التعلم الآلي (تحميل نموذج CLIP المُدرَّب مسبقًا) ---
# هذا الجزء سيتم تشغيله مرة واحدة فقط عند بدء الخدمة
try:
    # تحميل النموذج والمعالج (processor) الخاص بـ CLIP
    # "openai/clip-vit-base-patch32" هو نموذج CLIP أساسي.
    # هذا النموذج يولد تضمينات بحجم 512 بُعدًا (numDimensions = 512).
    # إذا كان فهرسك في Atlas يستخدم 2048 بُعدًا، فيجب عليك استخدام نموذج CLIP مختلف يولد هذا الحجم.
    # مثال لنموذج CLIP أكبر: "openai/clip-vit-large-patch14" (يولد 768 بُعدًا).
    model_name = "openai/clip-vit-base-patch32"
    clip_processor = CLIPProcessor.from_pretrained(model_name)
    
    # ✅ الأهم: استخدام TFCLIPModel بدلاً من CLIPModel لجعلها متوافقة مع TensorFlow
    clip_model = TFCLIPModel.from_pretrained(model_name) 
    
    # ✅ ملاحظة: إذا كنت تقوم بالتدريب الدقيق (Fine-tuning) لنموذج CLIP الخاص بك،
    # فستقوم بتحميل النموذج المُدرب الخاص بك هنا بدلاً من "from_pretrained".
    
    print(f"ML Model (CLIP: {model_name}) loaded successfully using TensorFlow backend.")

    # التحقق من حجم التضمين الذي يولده النموذج
    # ✅ الأهم: استخدام "tf" هنا لضمان توافق المدخلات مع TensorFlow
    dummy_input = clip_processor(images=Image.new('RGB', (224, 224)), return_tensors="tf") 
    dummy_embedding_size = clip_model.get_image_features(**dummy_input).shape[-1]
    print(f"DEBUG: CLIP model generates embeddings of size: {dummy_embedding_size}")

except Exception as e:
    print(f"Error loading CLIP model: {e}")
    exit()

# --- 4. تهيئة MongoDB ---
try:
    MONGO_URI = os.getenv("MONGO_URI")
    DB_NAME = os.getenv("DB_NAME")
    COLLECTION_NAME = os.getenv("COLLECTION_NAME")

    if not MONGO_URI:
        raise ValueError("MONGO_URI environment variable is not set. Please check your .env file or environment.")
    if not DB_NAME:
        raise ValueError("DB_NAME environment variable is not set. Please check your .env file or environment.")
    if not COLLECTION_NAME:
        raise ValueError("COLLECTION_NAME environment variable is not set. Please check your .env file or environment.")

    client = MongoClient(MONGO_URI)
    client.admin.command('ping') # إجبار PyMongo على إنشاء اتصال فوري
    
    db = client[DB_NAME]
    products_collection = db[COLLECTION_NAME]
    print("MongoDB client initialized and connected.")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    exit()

# --- 5. وظيفة مساعدة: معالجة الصورة واستخراج التضمين (Embedding) باستخدام CLIP ---
async def get_image_embedding(image_bytes: bytes):
    try:
        # فتح الصورة باستخدام Pillow وتحويلها إلى RGB (CLIP يتوقع 3 قنوات)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # معالجة الصورة باستخدام الـ processor الخاص بـ CLIP
        # ✅ الأهم: استخدام "tf" هنا لضمان توافق المدخلات مع TensorFlow
        inputs = clip_processor(images=image, return_tensors="tf") 
        
        # استخراج التضمين من النموذج
        # ✅ الأهم: أزل .detach() لأنه خاص بـ PyTorch، واستخدم .numpy() مباشرةً مع TensorFlow
        embedding = clip_model.get_image_features(**inputs).numpy()[0] 
        
        # تحويل مصفوفة NumPy إلى قائمة Python لتسهيل التخزين في JSON/MongoDB
        return embedding.tolist()
    except Exception as e:
        print(f"Error getting image embedding: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process image for embedding: {e}")

# --- 6. نقطة نهاية API: لتوليد التضمين لصور المنتجات (تُستدعى من Node.js عند إضافة/تحديث منتج) ---
class ImageUrlRequest(BaseModel):
    imageUrl: str # نتوقع استقبال عنوان URL لصورة المنتج من Node.js

@app.post("/generate-embedding")
async def generate_embedding_endpoint(request: ImageUrlRequest):
    try:
        response = requests.get(request.imageUrl)
        response.raise_for_status()

        embedding = await get_image_embedding(response.content)
        
        return {"embedding": embedding}
    except requests.exceptions.RequestException as e:
        print(f"Error downloading image from URL {request.imageUrl}: {e}")
        raise HTTPException(status_code=400, detail=f"Could not download image from URL: {e}. Please ensure Node.js server is serving static files correctly.")
    except Exception as e:
        print(f"Error in /generate-embedding endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embedding: {e}")

# --- 7. نقطة نهاية API: للبحث عن الصور المشابهة (تُستدعى من Node.js عندما يرفع المستخدم صورة) ---
@app.post("/search-image")
async def search_image_endpoint(image: UploadFile = File(...)): # نتوقع ملف صورة كمدخل
    try:
        # 1. قراءة بايتات الصورة المرفوعة من طلب الـ HTTP
        image_bytes = await image.read()
        # 2. حساب التضمين للصورة المرفوعة
        query_embedding = await get_image_embedding(image_bytes)

        # 3. استخدام MongoDB Atlas Vector Search للبحث عن التشابه
        # هذا يتطلب فهرس بحث متجهي (Vector Search Index) في MongoDB Atlas
        # "numDimensions" في فهرس Atlas يجب أن يطابق تماماً حجم التضمين الذي يولده نموذج CLIP.
        # نموذج "openai/clip-vit-base-patch32" يولد تضمينات بحجم 512 بُعدًا.
        # يجب أن يكون: "numDimensions": 512 في تعريف الفهرس الخاص بك في Atlas.
        
        search_results_cursor = products_collection.aggregate([
            {
                "$vectorSearch": {
                    "queryVector": query_embedding,
                    "path": "imageEmbedding",
                    "numCandidates": 100, # عدد المرشحين للبحث (يمكن تعديله)
                    "limit": 10, # عدد النتائج النهائية التي سيتم إرجاعها من Atlas
                    "index": "vector_index_1" # اسم فهرس البحث المتجهي الخاص بك في Atlas
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "score": { "$meta": "vectorSearchScore" } # للحصول على درجة التشابه من Atlas
                }
            }
        ])
        
        product_ids = []
        results_list = list(search_results_cursor) 

        print(f"DEBUG /search-image: Vector Search returned {len(results_list)} raw results from Atlas (before Python threshold).")
        
        if results_list:
            print("DEBUG /search-image: Atlas Scores and IDs:")
            for doc in results_list:
                print(f"  - ID: {doc['_id']}, Score: {doc['score']:.6f}")

        # 5. تطبيق عتبة تشابه دنيا (MIN_SIMILARITY_THRESHOLD)
        top_n = 10 
        MIN_SIMILARITY_THRESHOLD = 0.85 # تم تفعيل هذه القيمة (يمكنك تعديلها)
        
        final_product_ids = []
        for doc in results_list:
            if doc["score"] >= MIN_SIMILARITY_THRESHOLD:
                final_product_ids.append(str(doc["_id"]))
            else:
               print(f"DEBUG /search-image: Result with score {doc['score']:.4f} is below threshold {MIN_SIMILARITY_THRESHOLD}. Skipping.")

            if len(final_product_ids) >= top_n:
                break

        print(f"DEBUG Python ML: Product IDs being returned: {final_product_ids}")
        print(f"DEBUG Python ML: Type of first ID: {type(final_product_ids[0]) if final_product_ids else 'N/A'}")
        print(f"DEBUG Python ML: Length of first ID string: {len(final_product_ids[0]) if final_product_ids else 'N/A'}")

        print(f"DEBUG /search-image: Final top product IDs returned by Vector Search (after Python filtering): {final_product_ids} (Threshold: {MIN_SIMILARITY_THRESHOLD})")

        # 7. إرجاع معرفات المنتجات الأكثر تشابهاً
        return {"product_ids": final_product_ids} 
        
    except Exception as e:
        print(f"Error in /search-image endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Image search failed: {e}. Ensure MongoDB Atlas Vector Search is configured correctly and numDimensions matches CLIP model output.")

# --- 8. تشغيل خدمة Python ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PYTHON_ML_PORT", 5000)))