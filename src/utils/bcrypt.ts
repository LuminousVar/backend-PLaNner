async function hashPassword(password: string) {
  try {
    return await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 10,
    });
  } catch (err) {
    throw new Error("Hashing Password Gagal");
  }
}

async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hashedPassword, "bcrypt");
  } catch (err) {
    throw new Error("Verifikasi Password Gagal");
  }
}

//| Generate password untuk Testing
async function generateRandomPassword(length: number = 12): Promise<string> {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

export { hashPassword, verifyPassword, generateRandomPassword };
