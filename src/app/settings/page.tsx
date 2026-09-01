"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ShopSettingView } from "@/lib/types/shop";

export default function SettingsPage() {
  const [settings, setSettings] = useState<ShopSettingView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [gstin, setGstin] = useState("");
  const [billFooter, setBillFooter] = useState("");

  useEffect(() => {
    let ignore = false;

    async function fetchSettings() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load shop settings.");
        } else {
          const data: ShopSettingView = json.data;
          setSettings(data);
          setName(data.name || "");
          setTagline(data.tagline || "");
          setAddress(data.address || "");
          setPhoneNumber(data.phoneNumber || "");
          setEmail(data.email || "");
          setWebsite(data.website || "");
          setGstin(data.gstin || "");
          setBillFooter(data.billFooter || "");
        }
      } catch {
        if (!ignore) {
          setError("Network error loading shop settings.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    fetchSettings();

    return () => {
      ignore = true;
    };
  }, []);

  const handleReset = () => {
    if (settings) {
      setName(settings.name || "");
      setTagline(settings.tagline || "");
      setAddress(settings.address || "");
      setPhoneNumber(settings.phoneNumber || "");
      setEmail(settings.email || "");
      setWebsite(settings.website || "");
      setGstin(settings.gstin || "");
      setBillFooter(settings.billFooter || "");
      setError(null);
      setSuccessMessage(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!name.trim() || name.trim().length < 2) {
      setError("Business Name is required (minimum 2 characters).");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          tagline: tagline.trim() || null,
          address: address.trim() || null,
          phoneNumber: phoneNumber.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          gstin: gstin.trim() || null,
          billFooter: billFooter.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to update settings.");
      } else {
        setSettings(json.data);
        setSuccessMessage("Business settings updated successfully.");
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch {
      setError("Network error while saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight">
            Shop & Business Settings
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Configure business identity, contact details, and receipt notices used across Skubase bills and documents.
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-4 bg-danger-50 text-danger-700 text-xs font-semibold rounded-lg border border-danger-200">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-success-50 text-success-800 text-xs font-bold rounded-lg border border-success-200">
            ✓ {successMessage}
          </div>
        )}

        {isLoading ? (
          <div className="p-12 text-center text-surface-500 text-sm font-medium">
            Loading business settings...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Shop Profile */}
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider border-b border-surface-200 pb-2">
                Business Profile
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="shop-name" className="block text-xs font-bold text-surface-700 mb-1">
                    Business / Shop Name <span className="text-danger-600">*</span>
                  </label>
                  <input
                    id="shop-name"
                    type="text"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Skubase Tyre Hub"
                    className="w-full px-3 py-2 text-xs border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="shop-tagline" className="block text-xs font-bold text-surface-700 mb-1">
                    Tagline / Subtitle
                  </label>
                  <input
                    id="shop-tagline"
                    type="text"
                    maxLength={150}
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Quality Tyres, Wheel Alignment & Expert Service"
                    className="w-full px-3 py-2 text-xs border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="shop-address" className="block text-xs font-bold text-surface-700 mb-1">
                    Shop Address
                  </label>
                  <textarea
                    id="shop-address"
                    rows={3}
                    maxLength={300}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Plot No. 42, Main Automotive Hub, Opposite Transport Nagar, Mumbai - 400001"
                    className="w-full px-3 py-2 text-xs border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </Card>

            {/* 2. Contact Information */}
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider border-b border-surface-200 pb-2">
                Contact Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="shop-phone" className="block text-xs font-bold text-surface-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    id="shop-phone"
                    type="text"
                    maxLength={25}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 text-xs border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="shop-email" className="block text-xs font-bold text-surface-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="shop-email"
                    type="email"
                    maxLength={100}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. sales@skubasetyres.com"
                    className="w-full px-3 py-2 text-xs border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="shop-website" className="block text-xs font-bold text-surface-700 mb-1">
                    Website URL
                  </label>
                  <input
                    id="shop-website"
                    type="text"
                    maxLength={150}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="e.g. https://skubasetyres.com"
                    className="w-full px-3 py-2 text-xs border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </Card>

            {/* 3. Tax & Legal (Optional) */}
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider border-b border-surface-200 pb-2">
                Tax & Legal Information (Optional)
              </h2>

              <div>
                <label htmlFor="shop-gstin" className="block text-xs font-bold text-surface-700 mb-1">
                  GSTIN (Goods and Services Tax Identification Number)
                </label>
                <input
                  id="shop-gstin"
                  type="text"
                  maxLength={20}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  className="w-full max-w-sm px-3 py-2 text-xs font-mono border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-[11px] text-surface-500 mt-1">
                  If provided, your GSTIN will appear on sales receipts and bills. Note: Automated tax calculation engines remain a future milestone.
                </p>
              </div>
            </Card>

            {/* 4. Bill & Receipt Footer */}
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider border-b border-surface-200 pb-2">
                Bill & Receipt Footer Notice
              </h2>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="shop-footer" className="block text-xs font-bold text-surface-700">
                    Receipt Footer Note
                  </label>
                  <span className="text-[10px] text-surface-400 font-mono">
                    {billFooter.length} / 250 characters
                  </span>
                </div>
                <textarea
                  id="shop-footer"
                  rows={2}
                  maxLength={250}
                  value={billFooter}
                  onChange={(e) => setBillFooter(e.target.value)}
                  placeholder="e.g. Thank you for your business! Please check wheel torque and tyre pressure after 50 km."
                  className="w-full px-3 py-2 text-xs border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </Card>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isSaving}
                className="cursor-pointer"
              >
                Reset Changes
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
                className="bg-primary-700 hover:bg-primary-800 font-bold cursor-pointer px-6"
              >
                {isSaving ? "Saving Settings..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
