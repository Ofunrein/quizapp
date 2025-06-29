# 🚀 Setup Guide: History Tracking & Source Attribution

## 📋 **Quick Setup Checklist**

To enable the new history tracking features in your QuizMaster app:

### 1. **Database Schema Update**
Run the enhanced schema in your Supabase dashboard:

```sql
-- Copy and paste the contents of supabase/enhanced_schema.sql
-- into the SQL Editor in your Supabase dashboard
```

**Location**: `supabase/enhanced_schema.sql`

**What it adds**:
- ✅ `sources` table for content tracking
- ✅ `generations` table for AI generation history  
- ✅ `generation_items` table for detailed item tracking
- ✅ `topic_history` view for unified timeline
- ✅ RLS policies for security
- ✅ Indexes for performance

### 2. **Environment Variables**
Ensure you have the required API key:

```env
VITE_OPENAI_API_KEY=your_actual_openai_api_key_here
```

### 3. **Dependencies**
All required packages are already installed:
- ✅ `pdf-parse` - PDF text extraction
- ✅ `mammoth` - Word document processing
- ✅ `tesseract.js` - OCR for images
- ✅ `youtube-transcript` - YouTube transcript extraction
- ✅ `file-type` - File type detection

---

## 🎯 **New Features Available**

### **📚 History Tab**
Navigate to any topic and click the new **"History"** tab to see:

#### **🕒 Timeline View**
- Chronological display of all sources and AI generations
- Visual timeline with source type icons
- Detailed metadata for each entry

#### **📋 Sources View** 
- Overview of all ingested content
- Statistics: total sources, words, generated items
- Individual source cards with metadata

#### **🤖 AI Generations View**
- Complete generation history
- Expandable details showing individual items
- Performance metrics (processing time, item counts)

### **🔍 Enhanced Source Tracking**
Every piece of content now includes:
- **Source attribution** - know which file/video generated each question
- **Processing metadata** - file types, word counts, OCR status
- **Generation lineage** - trace any study item back to its source
- **Timestamps** - complete audit trail

### **📊 API Endpoint**
Access history programmatically:
```
GET /api/topics/:id/history
```

---

## 🧪 **Testing the Features**

### **1. Upload Different File Types**
Try uploading:
- 📄 **PDF documents** → See real text extraction
- 🖼️ **Images with text** → Watch OCR in action  
- 💻 **Code files** → See language detection
- 📝 **Word documents** → Full content extraction

### **2. Add YouTube Videos**
- Paste YouTube URLs → Get real transcript extraction
- Try educational videos, lectures, tutorials

### **3. Generate AI Content**
- Click "Generate Study Materials with AI"
- See comprehensive tracking in the History tab
- Notice source attribution on generated items

### **4. Explore History Views**
- Switch between Timeline, Sources, and Generations views
- Expand generation details to see individual items
- Check source statistics and metadata

---

## 🔧 **How It Works**

### **Source Tracking Flow**
```
File Upload → Content Processing → Storage → Knowledge Base → Source Entry → History
```

### **Generation Tracking Flow**
```
Generate Request → Source Collection → AI Processing → Question Creation → Generation Record → Item Attribution
```

### **Data Relationships**
- **Sources** → track all ingested content
- **Generations** → track AI processing batches
- **Generation Items** → link individual questions to sources
- **Topic History** → unified chronological view

---

## 📈 **Benefits for Users**

### **🎓 Learning Analytics**
- Track which sources generate the most valuable content
- Identify knowledge gaps by source coverage
- Monitor AI generation efficiency and quality

### **🔍 Content Management**  
- Find original sources for any study item
- Understand content lineage and dependencies
- Manage source diversity across topics

### **📋 Study Organization**
- Chronological view of learning material development
- Source-based filtering of study items
- Historical context for all materials

---

## ✅ **Verification Steps**

After running the schema update:

1. **✅ Upload a file** → Check if it appears in History → Sources
2. **✅ Add a YouTube video** → Verify transcript extraction tracking
3. **✅ Generate AI content** → See generation appear in History → AI Generations  
4. **✅ Check Timeline view** → Confirm chronological display
5. **✅ Expand generation details** → Verify individual item tracking

---

## 🐛 **Troubleshooting**

### **"Sources table doesn't exist"**
- Run the `supabase/enhanced_schema.sql` in your Supabase SQL Editor
- Ensure all tables were created successfully

### **"No history data showing"**
- Upload new content after running the schema update
- Existing content won't have source tracking (only new uploads)

### **"Generation tracking not working"**
- Ensure OpenAI API key is configured
- Check browser console for any JavaScript errors

---

## 🚀 **Ready to Use!**

Your QuizMaster app now has **enterprise-grade source tracking** and **comprehensive history**:

- ✅ **Every file upload** is tracked with full metadata
- ✅ **Every AI generation** is recorded with source attribution  
- ✅ **Complete audit trail** for all learning materials
- ✅ **Beautiful UI** for exploring content history
- ✅ **API access** for external integrations

**Upload some content and generate study materials to see the new history tracking in action!** 🎉 