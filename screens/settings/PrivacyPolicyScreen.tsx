/**
 * PrivacyPolicyScreen Component
 * Displays the Privacy Policy in a scrollable view
 */

import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import ScreenLayout from '../../components/layouts/ScreenLayout';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = require('react-native').Dimensions.get('window');

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

/**
 * Props for the PrivacyPolicyScreen component
 */
interface PrivacyPolicyScreenProps {
  /** Navigation route object containing params */
  route: {
    /** Route parameters */
    params: {
      /** Callback to close the screen */
      onClose: () => void;
    };
  };
}

const PrivacyPolicyScreen = React.memo(function PrivacyPolicyScreen({ route }: PrivacyPolicyScreenProps): React.ReactElement {
  const { onClose } = route.params;

  return (
    <ScreenLayout testID="privacy-policy-screen">
      {/* Header with back button and title on same line */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onClose} style={localStyles.backButton} testID="privacy-back-btn">
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title}>Privacy Policy</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          <Text style={localStyles.lastUpdated}>Last Modified: January 2026</Text>

          <Text style={localStyles.paragraph}>
            This Privacy Policy describes how Ducat Protocol Inc. ("Ducat", "we", or "us") may collect, use, disclose, and protect information about you. This Privacy Policy applies to information we collect when you access or use our website, mobile application, products, and services, or otherwise interact with us (collectively, our "Services").
          </Text>

          <Text style={localStyles.paragraph}>
            Please read this Privacy Policy carefully to understand our policies and practices regarding your information and how we treat it. If you do not agree with our policies and practices, your choice is not to interact with our Services. By accessing or using our Services you agree to this Privacy Policy.
          </Text>

          <Text style={localStyles.sectionTitle}>1. Personal Information We Collect</Text>
          <Text style={localStyles.paragraph}>
            We may collect certain information about you so that we can provide our Services, including:
          </Text>
          <Text style={localStyles.listItem}>
            • We collect information that you provide to us directly when, for example, you contact us through support tickets or subscribe to our communications.
          </Text>
          <Text style={localStyles.listItem}>
            • We automatically collect certain information related to your interactions with our Services.
          </Text>
          <Text style={localStyles.listItem}>
            • We may collect information about you from third parties like data analytics providers.
          </Text>

          <Text style={localStyles.paragraph}>
            The categories of information we may collect about you include:
          </Text>
          <Text style={localStyles.listItem}>
            • Personal Information: Information like your name, username, email address, and social media handle.
          </Text>
          <Text style={localStyles.listItem}>
            • Device and Usage Information: Information like your device type and other data about your device like its software and hardware details, browser type and version, IP address and operating system.
          </Text>
          <Text style={localStyles.listItem}>
            • Blockchain Data: Data like blockchain wallet addresses and transaction IDs.
          </Text>
          <Text style={localStyles.listItem}>
            • Communication Information: Information about your communications you submit to us.
          </Text>
          <Text style={localStyles.listItem}>
            • Location Information: Information that is collected may be used to determine approximate location and detect potential use of VPN services.
          </Text>
          <Text style={localStyles.listItem}>
            • Transaction Information: Information like non-identifying telemetry data for reliability and performance purposes of services and products.
          </Text>
          <Text style={localStyles.sectionTitle}>2. How We Use Your Personal Information</Text>
          <Text style={localStyles.paragraph}>
            We use the information we collect about you as required by applicable law, in connection with any purpose expressly described at the point of collection, or in accordance with a term in our agreements with you. We may also use the information we collect for the following purposes:
          </Text>
          <Text style={localStyles.listItem}>
            • Provide Our Services: Including by sending notices and security alerts related to our Services and responding to inquiries.
          </Text>
          <Text style={localStyles.listItem}>
            • Conduct Our Business Operations: Including for things like the development of new Services and monitoring and analyzing trends related to our Services.
          </Text>
          <Text style={localStyles.listItem}>
            • Safety and Security: Including for things like the prevention of spam, malware or actual or potential security risks, enforcement of a term in our agreements or policies, control our risks, and resolve inquiries or disputes.
          </Text>
          <Text style={localStyles.listItem}>
            • As Part of a Corporate Transaction: Including during negotiations or in connection with the sale of part or all of our assets.
          </Text>
          <Text style={localStyles.listItem}>
            • Marketing: We may use the information we collect to market our Services to you in accordance with your advertising and marketing preferences.
          </Text>

          <Text style={localStyles.sectionTitle}>3. How and Why We Share Your Personal Information</Text>
          <Text style={localStyles.paragraph}>
            We may share your personal information in the following circumstances:
          </Text>
          <Text style={localStyles.listItem}>
            • Companies that Assist Us: We may share your information with our contractors, vendors and service providers that assist us with our daily business operations.
          </Text>
          <Text style={localStyles.listItem}>
            • Our Affiliates: We may share your information with our affiliates in connection with our daily business operations.
          </Text>
          <Text style={localStyles.listItem}>
            • Fulfill Our Legal Obligations: We may share your information with law enforcement authorities including regulators to comply with laws and legal obligations.
          </Text>
          <Text style={localStyles.listItem}>
            • Professional Advisors: We may share your information with our professional advisors like attorneys, accountants, consultants, and auditors.
          </Text>
          <Text style={localStyles.listItem}>
            • During a Corporate Transaction: We may share your information with third parties during the initial actions or engagement of a merger, acquisition, or similar transaction.
          </Text>

          <Text style={localStyles.sectionTitle}>4. Analytics</Text>
          <Text style={localStyles.paragraph}>
            When you interact with our Services, we and/or the companies we work with may place cookies and/or similar technologies like web beacons, software development kits ("SDKs"), pixels, or APIs on your device. We and/or the companies we work with may collect information about your use of our Services and other websites and applications through your IP address, web browser, mobile network information, pages viewed, time spent on pages and mobile applications, links clicked, and conversation information.
          </Text>

          <Text style={localStyles.sectionTitle}>5. Your Choices</Text>
          <Text style={localStyles.listItem}>
            • Communications: You may opt out of receiving marketing communications from us by following instructions in such communications. If you opt-out, we may still send you non-promotional messages like those about our ongoing business relations.
          </Text>
          <Text style={localStyles.listItem}>
            • Cookies And Tracking Technologies: You can often adjust your browser setting to remove or reject browser cookies. If you remove or reject cookies, then the availability and functionality of our Services may be affected.
          </Text>
          <Text style={localStyles.listItem}>
            • Do Not Track: Most web browsers and some mobile operating systems include a Do Not Track ("DNT") feature setting you can activate to signal your privacy preference. We do not currently respond to DNT browser signals.
          </Text>

          <Text style={localStyles.sectionTitle}>6. International Transfers</Text>
          <Text style={localStyles.paragraph}>
            To facilitate our multinational operations, your personal information may be stored and processed in any country where we have operations or where we engage service providers. We will take measures to ensure that any such transfers comply with applicable data protection laws including through the use of contractual provisions.
          </Text>

          <Text style={localStyles.sectionTitle}>7. Security Of Information</Text>
          <Text style={localStyles.paragraph}>
            We use reasonable procedural, physical, and electronic safeguards to protect your personal information from unauthorized access or use. Still, we are unable to guarantee absolute security. The safety and security of your information also depends on you. Do not share your private cryptographic keys with anyone.
          </Text>

          <Text style={localStyles.sectionTitle}>8. How Long We Retain Your Personal Information</Text>
          <Text style={localStyles.paragraph}>
            We retain your information for as long as necessary to provide our Services, comply with legal obligations, enforce our legal agreements, and resolve disputes. The retention periods for your information are determined on a case-by-case basis depending on the nature of information and why it was collected and the applicable legal reasons for the retention of your information.
          </Text>

          <Text style={localStyles.sectionTitle}>9. Age Restrictions</Text>
          <Text style={localStyles.paragraph}>
            Our Services are not intended for anyone under the age of 18. We also do not knowingly collect personal information from anyone under the age of 18. In the event that we encounter information from an individual under the age of 18, we will take the appropriate steps. If you believe your child uploaded information in connection with our Services and is under the age of 18, please contact us by email at info@ducatprotocol.com.
          </Text>

          <Text style={localStyles.sectionTitle}>10. Changes To This Privacy Policy</Text>
          <Text style={localStyles.paragraph}>
            This Privacy Policy may change from time to time. We will notify you of any changes we make by revising the date at the top of this page. We may also provide you with a reasonable notice of any material changes before they take effect or as otherwise required by applicable law.
          </Text>

          <Text style={localStyles.sectionTitle}>11. Links To Third-Party Sites</Text>
          <Text style={localStyles.paragraph}>
            Our Services may contain links to other websites or services. We do not exercise control over the information you provide or is collected by these third-party websites. We encourage you to read the privacy policies or statements of the websites you visit.
          </Text>

          <Text style={localStyles.sectionTitle}>12. Contact Us</Text>
          <Text style={localStyles.paragraph}>
            To ask a question or comment on this Privacy Policy and our related practices, please email us at: info@ducatprotocol.com.
          </Text>

          <Text style={localStyles.sectionTitle}>13. Special Notice for EU and UK Residents</Text>
          <Text style={localStyles.paragraph}>
            If you reside in the EU or the UK, you have the right under certain circumstances:
          </Text>
          <Text style={localStyles.listItem}>
            • To be provided with access to your personal data held by us;
          </Text>
          <Text style={localStyles.listItem}>
            • To request the rectification or erasure of your personal data held by us;
          </Text>
          <Text style={localStyles.listItem}>
            • To request that we cease processing your data;
          </Text>
          <Text style={localStyles.listItem}>
            • To request that we restrict the processing of your personal data;
          </Text>
          <Text style={localStyles.listItem}>
            • To object to profiling activities based on our own legitimate interests;
          </Text>
          <Text style={localStyles.listItem}>
            • To object to solely automated processing producing legal or similar effects;
          </Text>
          <Text style={localStyles.listItem}>
            • To request that your data be transferred to a third party (data portability);
          </Text>
          <Text style={localStyles.listItem}>
            • To withdraw your consent to our processing of your data (where such processing is based on consent); and
          </Text>
          <Text style={localStyles.listItem}>
            • To lodge a complaint with the data protection authority in your jurisdiction.
          </Text>
          <Text style={localStyles.paragraph}>
            If you would like to exercise any of these rights, please email info@ducatprotocol.com. We may need to verify your identity before granting or otherwise changing or correcting your information.
          </Text>

          <View style={localStyles.bottomPadding} />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
});

export default PrivacyPolicyScreen;

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 0,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    flex: 1,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
    marginBottom: 20,
  },
  paragraph: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    lineHeight: 22,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginTop: 24,
    marginBottom: 12,
  },
  listItem: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
