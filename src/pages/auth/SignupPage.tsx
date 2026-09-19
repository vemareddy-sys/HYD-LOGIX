import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { BrandHeader } from '../../components/common/BrandHeader';
import type { UserRole } from '../../types/auth';
import { 
  User, 
  Mail, 
  Lock, 
  Building2, 
  Navigation, 
  ArrowRight, 
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  MailCheck
} from 'lucide-react';

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full legal or operator name.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must contain at least 6 characters.');
      return;
    }

    if (!selectedRole) {
      setErrorMessage('Mandatory: You must select exactly one operational role (Control Center or Driver).');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role: selectedRole,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Registration failed. Please check details and try again.');
        setIsSubmitting(false);
        return;
      }

      // Case A: Email confirmation required
      if (res.emailConfirmationRequired) {
        setPendingConfirmationEmail(email.trim());
        setIsSubmitting(false);
        return;
      }

      // Case B: Immediate session established
      if (selectedRole === 'CONTROL_CENTER') {
        navigate('/control', { replace: true });
      } else {
        navigate('/driver', { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during account creation.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Verification Dispatched State
  if (pendingConfirmationEmail) {
    return (
      <div className="min-h-screen bg-[#070b12] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{ 
            backgroundImage: 'linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px)', 
            backgroundSize: '48px 48px' 
          }} 
        />

        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
          <BrandHeader size="lg" />

          <div className="mt-8 panel-surface p-8 text-center border-amber-800/60 shadow-lg">
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-800/80 flex items-center justify-center text-logix-amber mb-4">
              <MailCheck className="w-6 h-6" />
            </div>

            <h2 className="font-tech text-lg uppercase tracking-wide text-slate-100 mb-2">
              Verification Link Dispatched
            </h2>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              A security verification link has been transmitted to:
            </p>

            <div className="p-2.5 rounded-lg bg-obsidian-950 border border-slate-800 font-mono text-xs text-amber-300 mb-6 break-all">
              {pendingConfirmationEmail}
            </div>

            <p className="text-[11px] text-slate-400 mb-6 leading-relaxed">
              Please click the link in your email to authenticate your operational role (<strong className="text-slate-200">{selectedRole}</strong>). Once verified, authenticate through the login terminal.
            </p>

            <Link
              to="/login"
              className="w-full btn-primary py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <span>Proceed to Login Terminal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-6 text-center text-[11px] font-mono text-slate-500">
            HYD-LOGIX SECURE PROTOCOL · VERIFICATION MANDATED
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle structural grid lines */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ 
          backgroundImage: 'linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px)', 
          backgroundSize: '48px 48px' 
        }} 
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <BrandHeader size="lg" />
        <div className="mt-4 text-center">
          <h2 className="font-tech text-lg uppercase tracking-wider text-slate-200">
            Account Registration & Role Binding
          </h2>
          <p className="mt-1 text-xs text-slate-400 font-mono">
            Permanent role allocation for Hyderabad logistics network
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4">
        <div className="panel-surface p-8">
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-lg bg-rose-950/50 border border-rose-800/80 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Full Name */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                Full Name / Operator ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Vikramaditya Rao"
                  className="input-field pl-9"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="v.rao@hyd-logix.in"
                  className="input-field pl-9 font-mono text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                Password (Min. 6 Characters)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="input-field pl-9 font-mono text-sm"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Operational Role Assignment <span className="text-amber-500">*</span>
                </label>
                <span className="text-[11px] font-mono text-amber-400/90">
                  Choose exactly one
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* CONTROL_CENTER Card */}
                <button
                  type="button"
                  onClick={() => setSelectedRole('CONTROL_CENTER')}
                  className={`p-4 rounded-xl text-left border transition-all duration-150 relative ${
                    selectedRole === 'CONTROL_CENTER'
                      ? 'bg-amber-950/25 border-logix-amber ring-1 ring-logix-amber/50 shadow-sm'
                      : 'bg-obsidian-950/80 border-slate-800 hover:border-slate-700 hover:bg-obsidian-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${
                      selectedRole === 'CONTROL_CENTER' 
                        ? 'bg-logix-amber/20 text-logix-amber' 
                        : 'bg-obsidian-850 text-slate-400'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    {selectedRole === 'CONTROL_CENTER' && (
                      <CheckCircle2 className="w-4 h-4 text-logix-amber" />
                    )}
                  </div>
                  <div className="font-tech text-sm font-semibold tracking-wide text-slate-100">
                    CONTROL CENTER
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Fleet management, mission dispatch, road intelligence, and AI routing lab.
                  </p>
                  <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-obsidian-850 text-amber-400/80 border border-amber-900/40">
                    Target: /control
                  </div>
                </button>

                {/* DRIVER Card */}
                <button
                  type="button"
                  onClick={() => setSelectedRole('DRIVER')}
                  className={`p-4 rounded-xl text-left border transition-all duration-150 relative ${
                    selectedRole === 'DRIVER'
                      ? 'bg-amber-950/25 border-logix-amber ring-1 ring-logix-amber/50 shadow-sm'
                      : 'bg-obsidian-950/80 border-slate-800 hover:border-slate-700 hover:bg-obsidian-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${
                      selectedRole === 'DRIVER' 
                        ? 'bg-logix-amber/20 text-logix-amber' 
                        : 'bg-obsidian-850 text-slate-400'
                    }`}>
                      <Navigation className="w-5 h-5" />
                    </div>
                    {selectedRole === 'DRIVER' && (
                      <CheckCircle2 className="w-4 h-4 text-logix-amber" />
                    )}
                  </div>
                  <div className="font-tech text-sm font-semibold tracking-wide text-slate-100">
                    DRIVER TERMINAL
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Mobile-first turn navigation, active mission execution, and road incident reporting.
                  </p>
                  <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-obsidian-850 text-emerald-400/80 border border-emerald-900/40">
                    Target: /driver
                  </div>
                </button>
              </div>

              {/* Permanent Warning */}
              <div className="mt-3 p-3 rounded-lg bg-obsidian-950/80 border border-slate-800 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] font-mono text-slate-400 leading-tight">
                  <strong className="text-slate-300">Permanent Role Binding:</strong> Selected role cannot be changed post-creation. A separate account with a different email is required for the other role.
                </p>
              </div>
            </div>

            {/* Submit */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting || !selectedRole}
                className="w-full btn-primary py-3 text-sm font-semibold tracking-wide flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    <span>Configuring Account & Profile...</span>
                  </>
                ) : (
                  <>
                    <span>Create Permanent Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-400">
              Already registered?{' '}
              <Link 
                to="/login" 
                className="font-medium text-logix-amber hover:text-amber-400 transition-colors"
              >
                Access existing terminal
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] font-mono text-slate-500">
          STRICT ROLE SEPARATION ENFORCED VIA DATABASE CONSTRAINTS & RLS
        </div>
      </div>
    </div>
  );
};
