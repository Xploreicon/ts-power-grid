# Requirements Document

## Introduction

The T&S Power Grid UI Component Library provides a comprehensive set of reusable, accessible, and type-safe React components that embody the design language of "utility-grade trust meets entrepreneurial empowerment." The library enables consistent user experiences across the platform's marketing, host, and admin interfaces while maintaining premium infrastructure aesthetics with warmth.

## Glossary

- **Component_Library**: The collection of reusable UI components built for T&S Power Grid
- **Design_System**: The visual language, typography, colors, spacing, and interaction patterns that define the T&S Power Grid brand
- **Button_Component**: An interactive element that triggers actions when clicked
- **Card_Component**: A container component that groups related content with visual boundaries
- **Input_Component**: A form field that accepts user text input
- **Badge_Component**: A small visual indicator displaying status or category information
- **Stat_Card_Component**: A specialized card displaying numerical metrics with optional trend indicators
- **Avatar_Component**: A visual representation of a user using initials or images
- **Nav_Component**: The top navigation bar providing primary navigation links
- **Bottom_Tab_Bar**: The mobile navigation component with fixed bottom positioning
- **Toast_Component**: A temporary notification message that appears and auto-dismisses
- **Modal_Component**: An overlay dialog that requires user interaction before dismissing
- **Skeleton_Component**: A loading placeholder that indicates content is being fetched
- **Empty_State_Component**: A component displayed when no data or content is available
- **Showcase_Page**: An internal reference page demonstrating all components and their variants
- **CN_Utility**: A utility function that merges Tailwind CSS classes using clsx and tailwind-merge
- **Lucide_Icons**: The icon library used throughout the component library
- **Variant**: A visual or behavioral variation of a component (e.g., primary, secondary, ghost)
- **Prop**: A React component property that configures behavior or appearance
- **TypeScript_Type**: A type definition that provides compile-time type safety
- **ARIA_Label**: An accessibility attribute that provides screen reader descriptions
- **Keyboard_Navigation**: The ability to interact with components using keyboard inputs

## Requirements

### Requirement 1: Utility Function for Class Composition

**User Story:** As a developer, I want a utility function that safely merges Tailwind CSS classes, so that I can compose component styles without class conflicts.

#### Acceptance Criteria

1. THE CN_Utility SHALL accept multiple class name arguments of type string, undefined, or null
2. THE CN_Utility SHALL merge conflicting Tailwind classes using tailwind-merge
3. THE CN_Utility SHALL combine class names using clsx
4. THE CN_Utility SHALL return a single merged class string
5. THE CN_Utility SHALL be exported from /lib/utils/cn.ts

### Requirement 2: Button Component

**User Story:** As a developer, I want a flexible button component with multiple variants and states, so that I can create consistent interactive elements throughout the application.

#### Acceptance Criteria

1. THE Button_Component SHALL support variants: primary, secondary, ghost, and danger
2. THE Button_Component SHALL support sizes: sm, md, and lg
3. WHEN the loading prop is true, THE Button_Component SHALL display a spinner and disable interaction
4. WHERE an icon prop is provided, THE Button_Component SHALL render the icon on the left or right side based on iconPosition prop
5. WHERE the asChild prop is true, THE Button_Component SHALL render its child element with button styles applied
6. THE Button_Component SHALL export TypeScript types for all props
7. THE Button_Component SHALL be keyboard accessible with proper focus states
8. WHEN variant is primary, THE Button_Component SHALL use yellow background with navy text
9. WHEN variant is secondary, THE Button_Component SHALL use navy border with navy text and transparent background
10. WHEN variant is ghost, THE Button_Component SHALL use text only with no background or border
11. WHEN variant is danger, THE Button_Component SHALL use red background with white text
12. THE Button_Component SHALL apply 12px border radius

### Requirement 3: Card Component

**User Story:** As a developer, I want a card component with subcomponents for structured content, so that I can create consistent content containers.

#### Acceptance Criteria

1. THE Card_Component SHALL support variants: default, elevated, and dark
2. THE Card_Component SHALL export CardHeader, CardBody, and CardFooter subcomponents
3. WHEN variant is default, THE Card_Component SHALL use white background with border
4. WHEN variant is elevated, THE Card_Component SHALL use shadow-lg
5. WHEN variant is dark, THE Card_Component SHALL use navy-900 background with white text
6. WHERE the interactive prop is true, THE Card_Component SHALL apply hover lift effect
7. THE Card_Component SHALL apply 12px border radius
8. THE Card_Component SHALL export TypeScript types for all props

### Requirement 4: Input Component

**User Story:** As a developer, I want an input component with label, validation, and specialized variants, so that I can create consistent form fields.

#### Acceptance Criteria

1. THE Input_Component SHALL render a label when the label prop is provided
2. THE Input_Component SHALL render hint text when the hint prop is provided
3. WHEN the error prop is provided, THE Input_Component SHALL display error styling and error message
4. WHERE the variant is currency, THE Input_Component SHALL prefix the input with ₦ symbol
5. WHERE the variant is phone, THE Input_Component SHALL prefix the input with +234
6. WHERE an icon prop is provided, THE Input_Component SHALL render the icon inside the input field
7. THE Input_Component SHALL apply 12px border radius
8. THE Input_Component SHALL export TypeScript types for all props
9. THE Input_Component SHALL include proper ARIA labels for accessibility

### Requirement 5: Badge Component

**User Story:** As a developer, I want a badge component with status variants, so that I can display categorical or status information consistently.

#### Acceptance Criteria

1. THE Badge_Component SHALL support variants: default, success, warning, danger, yellow, and navy
2. WHERE the dot prop is true, THE Badge_Component SHALL render a dot indicator before the text
3. WHERE the pulse prop is true, THE Badge_Component SHALL animate the dot indicator with a pulse effect
4. WHEN variant is success, THE Badge_Component SHALL use green color scheme
5. WHEN variant is warning, THE Badge_Component SHALL use amber color scheme
6. WHEN variant is danger, THE Badge_Component SHALL use red color scheme
7. WHEN variant is yellow, THE Badge_Component SHALL use yellow color scheme
8. WHEN variant is navy, THE Badge_Component SHALL use navy color scheme
9. THE Badge_Component SHALL export TypeScript types for all props

### Requirement 6: Stat Card Component

**User Story:** As a developer, I want a specialized card for displaying metrics, so that I can present numerical data consistently with optional trend indicators.

#### Acceptance Criteria

1. THE Stat_Card_Component SHALL display a large number using JetBrains Mono font
2. THE Stat_Card_Component SHALL display a label below the number
3. WHERE the trend prop is provided, THE Stat_Card_Component SHALL display an up or down arrow with percentage
4. THE Stat_Card_Component SHALL support variants: default, dark, and highlight
5. WHEN variant is highlight, THE Stat_Card_Component SHALL use yellow background
6. WHEN variant is dark, THE Stat_Card_Component SHALL use navy-900 background with white text
7. THE Stat_Card_Component SHALL apply 12px border radius
8. THE Stat_Card_Component SHALL export TypeScript types for all props

### Requirement 7: Avatar Component

**User Story:** As a developer, I want an avatar component that displays user initials with status indicators, so that I can represent users consistently.

#### Acceptance Criteria

1. THE Avatar_Component SHALL generate initials from the name prop
2. THE Avatar_Component SHALL use navy background with yellow text for initials
3. THE Avatar_Component SHALL support sizes: xs, sm, md, and lg
4. WHERE the status prop is provided, THE Avatar_Component SHALL display a status dot
5. THE Avatar_Component SHALL support status values: online, offline, and idle
6. WHEN status is online, THE Avatar_Component SHALL display a green status dot
7. WHEN status is offline, THE Avatar_Component SHALL display a gray status dot
8. WHEN status is idle, THE Avatar_Component SHALL display an amber status dot
9. THE Avatar_Component SHALL render as a circle
10. THE Avatar_Component SHALL export TypeScript types for all props

### Requirement 8: Nav Component

**User Story:** As a developer, I want a top navigation bar component, so that I can provide consistent primary navigation across desktop and mobile.

#### Acceptance Criteria

1. THE Nav_Component SHALL provide a logo area on the left
2. THE Nav_Component SHALL provide a center area for navigation links
3. THE Nav_Component SHALL provide a right area for action buttons
4. WHEN viewport width is below 768px, THE Nav_Component SHALL display a hamburger menu icon
5. WHEN the hamburger icon is clicked, THE Nav_Component SHALL toggle a mobile menu
6. THE Nav_Component SHALL use Lucide icons for the hamburger menu
7. THE Nav_Component SHALL export TypeScript types for all props
8. THE Nav_Component SHALL be keyboard accessible

### Requirement 9: Bottom Tab Bar Component

**User Story:** As a host using the PWA, I want a fixed bottom navigation bar, so that I can quickly access primary sections.

#### Acceptance Criteria

1. THE Bottom_Tab_Bar SHALL render 4 tabs: Home, Neighbors, Earnings, and Support
2. THE Bottom_Tab_Bar SHALL use Lucide icons for each tab
3. WHEN a tab is active, THE Bottom_Tab_Bar SHALL display navy text and a navy indicator
4. WHEN a tab is inactive, THE Bottom_Tab_Bar SHALL display muted text
5. THE Bottom_Tab_Bar SHALL remain fixed at the bottom of the viewport
6. THE Bottom_Tab_Bar SHALL export TypeScript types for all props
7. THE Bottom_Tab_Bar SHALL be keyboard accessible with proper focus management

### Requirement 10: Toast Component

**User Story:** As a developer, I want a toast notification component, so that I can display temporary feedback messages to users.

#### Acceptance Criteria

1. THE Toast_Component SHALL wrap the sonner library with T&S styling
2. THE Toast_Component SHALL support variants: success, error, info, and warning
3. WHEN variant is success, THE Toast_Component SHALL use green color scheme
4. WHEN variant is error, THE Toast_Component SHALL use red color scheme
5. WHEN variant is info, THE Toast_Component SHALL use navy color scheme
6. WHEN variant is warning, THE Toast_Component SHALL use amber color scheme
7. THE Toast_Component SHALL auto-dismiss after a configurable duration
8. THE Toast_Component SHALL export TypeScript types for all props

### Requirement 11: Modal Component

**User Story:** As a developer, I want a modal dialog component, so that I can display focused content that requires user interaction.

#### Acceptance Criteria

1. THE Modal_Component SHALL render centered on the viewport
2. THE Modal_Component SHALL display a backdrop with blur effect
3. THE Modal_Component SHALL include a close button
4. THE Modal_Component SHALL export ModalTitle, ModalBody, and ModalFooter subcomponents
5. WHEN the close button is clicked, THE Modal_Component SHALL trigger the onClose callback
6. WHEN the Escape key is pressed, THE Modal_Component SHALL trigger the onClose callback
7. WHEN the backdrop is clicked, THE Modal_Component SHALL trigger the onClose callback
8. THE Modal_Component SHALL trap focus within the modal when open
9. THE Modal_Component SHALL apply 12px border radius
10. THE Modal_Component SHALL export TypeScript types for all props
11. THE Modal_Component SHALL include proper ARIA attributes for accessibility

### Requirement 12: Skeleton Loader Component

**User Story:** As a developer, I want a skeleton loader component, so that I can indicate loading states with visual placeholders.

#### Acceptance Criteria

1. THE Skeleton_Component SHALL display a shimmer animation
2. THE Skeleton_Component SHALL use yellow tint for the shimmer effect
3. THE Skeleton_Component SHALL accept width and height props
4. THE Skeleton_Component SHALL apply 12px border radius
5. THE Skeleton_Component SHALL export TypeScript types for all props

### Requirement 13: Empty State Component

**User Story:** As a developer, I want an empty state component, so that I can communicate when no data is available with a clear call-to-action.

#### Acceptance Criteria

1. THE Empty_State_Component SHALL display a Lucide icon
2. THE Empty_State_Component SHALL display a title using Fraunces font
3. THE Empty_State_Component SHALL display a description
4. WHERE a CTA prop is provided, THE Empty_State_Component SHALL render a call-to-action button
5. THE Empty_State_Component SHALL center all content vertically and horizontally
6. THE Empty_State_Component SHALL export TypeScript types for all props

### Requirement 14: Component Export Structure

**User Story:** As a developer, I want all components exported from a single index file, so that I can import components with clean syntax.

#### Acceptance Criteria

1. THE Component_Library SHALL export all components from /components/ui/index.ts
2. THE Component_Library SHALL export all TypeScript types from /components/ui/index.ts
3. FOR ALL components, each component SHALL be in its own file under /components/ui
4. THE Component_Library SHALL use barrel exports for clean import paths

### Requirement 15: Design System Showcase Page

**User Story:** As a developer, I want a showcase page demonstrating all components, so that I can reference component usage and variants.

#### Acceptance Criteria

1. THE Showcase_Page SHALL be located at /app/design-system
2. THE Showcase_Page SHALL display every component from the Component_Library
3. THE Showcase_Page SHALL display every variant of each component
4. THE Showcase_Page SHALL group components by category
5. THE Showcase_Page SHALL include component names and variant labels
6. THE Showcase_Page SHALL use the T&S design language for layout and styling
7. THE Showcase_Page SHALL be visually polished despite being internal-only

### Requirement 16: Accessibility Compliance

**User Story:** As a user with disabilities, I want all components to be accessible, so that I can use the platform with assistive technologies.

#### Acceptance Criteria

1. WHERE a component is interactive, THE Component_Library SHALL support keyboard navigation
2. WHERE a component conveys information visually, THE Component_Library SHALL include ARIA labels
3. WHERE a component has focus states, THE Component_Library SHALL provide visible focus indicators
4. THE Modal_Component SHALL trap focus and restore focus on close
5. THE Button_Component SHALL be operable via keyboard (Enter and Space keys)
6. THE Input_Component SHALL associate labels with inputs using proper HTML attributes

### Requirement 17: TypeScript Type Safety

**User Story:** As a developer, I want comprehensive TypeScript types for all components, so that I can catch errors at compile time and benefit from IDE autocomplete.

#### Acceptance Criteria

1. FOR ALL components, THE Component_Library SHALL export prop types
2. FOR ALL components with variants, THE Component_Library SHALL use TypeScript union types for variant props
3. FOR ALL components with size options, THE Component_Library SHALL use TypeScript union types for size props
4. THE Component_Library SHALL use TypeScript generics where appropriate for flexible typing
5. THE Component_Library SHALL avoid using 'any' type except where absolutely necessary

### Requirement 18: Design Token Consistency

**User Story:** As a designer, I want all components to use consistent design tokens, so that the visual language remains cohesive.

#### Acceptance Criteria

1. FOR ALL components, THE Component_Library SHALL use navy (#0A2540) as the primary color
2. FOR ALL components, THE Component_Library SHALL use yellow (#FFB800) strictly for CTAs and earnings displays
3. FOR ALL components with rounded corners, THE Component_Library SHALL apply 12px border radius
4. FOR ALL components, THE Component_Library SHALL use spacing values of 16px or 24px for gaps
5. FOR ALL components with shadows, THE Component_Library SHALL use shadow-sm by default
6. FOR ALL elevated components, THE Component_Library SHALL use shadow-lg
7. FOR ALL components, THE Component_Library SHALL use Fraunces font for display and headings
8. FOR ALL components, THE Component_Library SHALL use Plus Jakarta Sans font for body text
9. FOR ALL components displaying numbers, THE Component_Library SHALL use JetBrains Mono font
10. FOR ALL components, THE Component_Library SHALL use Lucide icons exclusively

