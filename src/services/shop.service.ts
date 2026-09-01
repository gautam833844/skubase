import { db } from "@/lib/db";
import { requirePermission, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { defaultShopConfig } from "@/config/shop.config";
import type { ShopSettingView, UpdateShopSettingsInput } from "@/lib/types/shop";

export { type ShopSettingView, type UpdateShopSettingsInput };

/**
 * Retrieves the centralized shop/business settings:
 * - If actor provided, verifies settings:view permission.
 * - Queries the shop_settings database record.
 * - Falls back to defaultShopConfig if not yet configured in DB.
 */
export async function getShopSettings(actor?: AuthActor): Promise<ShopSettingView> {
  if (actor) {
    requirePermission(actor, "settings:view", "ALL");
  }

  const setting = await db.shopSetting.findFirst();

  if (!setting) {
    return {
      id: "default-shop-settings",
      name: defaultShopConfig.name,
      tagline: defaultShopConfig.tagline,
      address: `${defaultShopConfig.addressLine1}, ${defaultShopConfig.addressLine2}, ${defaultShopConfig.city}`,
      phoneNumber: defaultShopConfig.phoneNumber,
      email: defaultShopConfig.email,
      website: null,
      gstin: null,
      billFooter: defaultShopConfig.footerNotice,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id: setting.id,
    name: setting.name,
    tagline: setting.tagline,
    address: setting.address,
    phoneNumber: setting.phoneNumber,
    email: setting.email,
    website: setting.website,
    gstin: setting.gstin,
    billFooter: setting.billFooter,
    updatedAt: setting.updatedAt.toISOString(),
  };
}

/**
 * Updates the centralized shop/business settings:
 * - Authorizes against settings:manage (ADMIN_OWNER & MANAGER).
 * - Validates input lengths and formats (business name, email, phone, footer).
 * - Upserts the single database configuration record.
 * - Records transactional audit log (SHOP_SETTINGS_UPDATED).
 * - Leaves all sales, inventory, payments, and customer records completely untouched.
 */
export async function updateShopSettings(
  input: UpdateShopSettingsInput,
  actor: AuthActor
): Promise<ShopSettingView> {
  requirePermission(actor, "settings:manage", "ALL");

  const name = input.name?.trim();
  if (!name || name.length < 2 || name.length > 120) {
    throw new AppError(
      "VALIDATION",
      "Business name must be between 2 and 120 characters",
      "Please provide a valid business name (2–120 characters)."
    );
  }

  const tagline = input.tagline ? input.tagline.trim() : null;
  if (tagline && tagline.length > 150) {
    throw new AppError(
      "VALIDATION",
      "Tagline cannot exceed 150 characters",
      "Tagline is too long (maximum 150 characters)."
    );
  }

  const address = input.address ? input.address.trim() : null;
  if (address && address.length > 300) {
    throw new AppError(
      "VALIDATION",
      "Address cannot exceed 300 characters",
      "Address is too long (maximum 300 characters)."
    );
  }

  const phoneNumber = input.phoneNumber ? input.phoneNumber.trim() : null;
  if (phoneNumber && phoneNumber.length > 25) {
    throw new AppError(
      "VALIDATION",
      "Phone number cannot exceed 25 characters",
      "Phone number is too long (maximum 25 characters)."
    );
  }

  const email = input.email ? input.email.trim() : null;
  if (email) {
    if (email.length > 100) {
      throw new AppError(
        "VALIDATION",
        "Email cannot exceed 100 characters",
        "Email is too long (maximum 100 characters)."
      );
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError(
        "VALIDATION",
        "Invalid email address format",
        "Please provide a valid email address."
      );
    }
  }

  const website = input.website ? input.website.trim() : null;
  if (website && website.length > 150) {
    throw new AppError(
      "VALIDATION",
      "Website cannot exceed 150 characters",
      "Website is too long (maximum 150 characters)."
    );
  }

  const gstin = input.gstin ? input.gstin.trim() : null;
  if (gstin) {
    if (gstin.length > 20) {
      throw new AppError(
        "VALIDATION",
        "GSTIN cannot exceed 20 characters",
        "GSTIN is too long (maximum 20 characters)."
      );
    }
  }

  const billFooter = input.billFooter ? input.billFooter.trim() : null;
  if (billFooter && billFooter.length > 250) {
    throw new AppError(
      "VALIDATION",
      "Bill footer cannot exceed 250 characters",
      "Bill footer is too long (maximum 250 characters)."
    );
  }

  const existing = await db.shopSetting.findFirst();

  let updatedSetting;
  if (existing) {
    updatedSetting = await db.shopSetting.update({
      where: { id: existing.id },
      data: {
        name,
        tagline,
        address,
        phoneNumber,
        email,
        website,
        gstin,
        billFooter,
      },
    });
  } else {
    updatedSetting = await db.shopSetting.create({
      data: {
        name,
        tagline,
        address,
        phoneNumber,
        email,
        website,
        gstin,
        billFooter,
      },
    });
  }

  // Record Audit Log
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      entityName: "ShopSetting",
      entityId: updatedSetting.id,
      action: "SHOP_SETTINGS_UPDATED",
      oldState: existing
        ? {
            name: existing.name,
            address: existing.address,
            phoneNumber: existing.phoneNumber,
            email: existing.email,
          }
        : undefined,
      newState: {
        name: updatedSetting.name,
        address: updatedSetting.address,
        phoneNumber: updatedSetting.phoneNumber,
        email: updatedSetting.email,
      },
    },
  });

  return {
    id: updatedSetting.id,
    name: updatedSetting.name,
    tagline: updatedSetting.tagline,
    address: updatedSetting.address,
    phoneNumber: updatedSetting.phoneNumber,
    email: updatedSetting.email,
    website: updatedSetting.website,
    gstin: updatedSetting.gstin,
    billFooter: updatedSetting.billFooter,
    updatedAt: updatedSetting.updatedAt.toISOString(),
  };
}
