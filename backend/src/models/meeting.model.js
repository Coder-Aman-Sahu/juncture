import mongoose,{Schema} from "mongoose";

const meetingSchema = new Schema(
    {
        user_id:{type:String},
        meeting_Code:{type:String,required:true,unique:true},
        date:{type:Date,default:Date.now,required:true}
    }
)

const Meeting=mongoose.model("Meeting",meetingSchema);

export {Meeting};