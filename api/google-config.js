const measurementId=String(process.env.GA_MEASUREMENT_ID||"").trim();

module.exports=async(req,res)=>{
  if(req.method!=="GET")return res.status(405).json({error:"Método não permitido"});
  res.setHeader("Cache-Control","public, max-age=300, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).json({
    enabled:/^G-[A-Z0-9]+$/i.test(measurementId),
    measurementId:/^G-[A-Z0-9]+$/i.test(measurementId)?measurementId:null
  });
};
