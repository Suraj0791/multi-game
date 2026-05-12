

export default function createUser(username, email, password){
    1 //check if this email already exist or not if exist return error
    const user=findbyEmail(email);

    if(user) throw app erorr 
    2//if not then we hash the passowrd first nd store the user to db stored the hadhed passowrd nd return the user to controller 
    const hashedpass=hashing 

    cont user=db.create();

    return user 

}

export default function getUserService(){
    
}

